#!/usr/bin/env npx tsx

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

const rootDir = resolve(new URL('..', import.meta.url).pathname)
const enDir = resolve(rootDir, 'src/locales/en')
const myDir = resolve(rootDir, 'src/locales/my')
const reportPath = resolve(rootDir, 'i18n-parity-report.json')

interface ParityItem {
  severity: 'P0' | 'P1' | 'P2'
  check: string
  message: string
  details?: Record<string, unknown>
}

interface CheckResult {
  name: string
  severity: 'P0' | 'P1' | 'P2'
  status: 'clean' | 'drift'
  itemCount: number
  items: ParityItem[]
}

function readJsonFile(filePath: string): Record<string, unknown> {
  const content = readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${filePath} does not contain a JSON object`)
  }
  return parsed as Record<string, unknown>
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, path))
      continue
    }
    result[path] = String(value)
  }

  return result
}

function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{\{\s*[^{}\s]+\s*\}\}/g) || []
  return matches.map((match) => match.replace(/\{\{|\}\}/g, '').trim())
}

function buildCheck(name: string, severity: 'P0' | 'P1' | 'P2', items: ParityItem[]): CheckResult {
  return {
    name,
    severity,
    status: items.length > 0 ? 'drift' : 'clean',
    itemCount: items.length,
    items,
  }
}

function writeReport(checks: CheckResult[]) {
  const summary = {
    p0: checks.reduce((total, check) => total + check.items.filter((item) => item.severity === 'P0').length, 0),
    p1: checks.reduce((total, check) => total + check.items.filter((item) => item.severity === 'P1').length, 0),
    p2: checks.reduce((total, check) => total + check.items.filter((item) => item.severity === 'P2').length, 0),
    total: checks.reduce((total, check) => total + check.items.length, 0),
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary,
    checks,
  }

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
}

function collectJsonFiles(dirPath: string): Record<string, Record<string, unknown>> {
  if (!existsSync(dirPath)) {
    return {}
  }

  const files = readdirSync(dirPath)
    .filter((file) => file.endsWith('.json'))
    .sort()

  const jsonFiles: Record<string, Record<string, unknown>> = {}

  for (const file of files) {
    const filePath = join(dirPath, file)
    jsonFiles[file] = readJsonFile(filePath)
  }

  return jsonFiles
}

function main() {
  const enFiles = collectJsonFiles(enDir)
  const myFiles = collectJsonFiles(myDir)

  const checks: CheckResult[] = []

  const missingDirAdvisory: string[] = []
  if (!existsSync(enDir)) {
    missingDirAdvisory.push('src/locales/en')
  }
  if (!existsSync(myDir)) {
    missingDirAdvisory.push('src/locales/my')
  }

  if (missingDirAdvisory.length > 0) {
    console.log(`ADVISORY: missing locale directory: ${missingDirAdvisory.join(', ')}. Treating as clean.`)
  }

  if (Object.keys(enFiles).length === 0 || Object.keys(myFiles).length === 0) {
    if (missingDirAdvisory.length === 0) {
      console.log('ADVISORY: no locale JSON files found yet. Treating as clean.')
    }
    writeReport(checks)
    return
  }

  const enFlat: Record<string, string> = {}
  for (const file of Object.values(enFiles)) {
    Object.assign(enFlat, flattenObject(file))
  }

  const myFlat: Record<string, string> = {}
  for (const file of Object.values(myFiles)) {
    Object.assign(myFlat, flattenObject(file))
  }

  const missingInMy: ParityItem[] = []
  for (const [key, value] of Object.entries(enFlat)) {
    if (!(key in myFlat)) {
      missingInMy.push({
        severity: 'P0',
        check: 'en_missing_in_my',
        message: `${key} is missing from my locale`,
        details: { key, expected: value },
      })
      continue
    }

    const enPlaceholders = extractPlaceholders(value)
    const myPlaceholders = extractPlaceholders(myFlat[key])
    if (JSON.stringify(enPlaceholders) !== JSON.stringify(myPlaceholders)) {
      missingInMy.push({
        severity: 'P0',
        check: 'placeholder_mismatch',
        message: `${key} has mismatched placeholders: en=${enPlaceholders.join(', ') || 'none'} my=${myPlaceholders.join(', ') || 'none'}`,
        details: { key, en: enPlaceholders, my: myPlaceholders },
      })
    }
  }
  checks.push(buildCheck('en_missing_in_my', 'P0', missingInMy))

  const missingInEn: ParityItem[] = []
  for (const [key, value] of Object.entries(myFlat)) {
    if (!(key in enFlat)) {
      missingInEn.push({
        severity: 'P1',
        check: 'my_missing_in_en',
        message: `${key} is missing from en locale`,
        details: { key, actual: value },
      })
    }

    if (String(value).trim() === '') {
      missingInEn.push({
        severity: 'P1',
        check: 'empty_my_value',
        message: `${key} is empty in my locale`,
        details: { key, value },
      })
    }
  }
  checks.push(buildCheck('my_missing_in_en', 'P1', missingInEn))

  writeReport(checks)

  const p0Count = checks.reduce((total, check) => total + check.items.filter((item) => item.severity === 'P0').length, 0)
  const p1Count = checks.reduce((total, check) => total + check.items.filter((item) => item.severity === 'P1').length, 0)

  if (p0Count > 0) {
    console.error(`P0 issues found (${p0Count}). See ${reportPath}`)
    process.exitCode = 1
    return
  }

  if (p1Count > 0) {
    console.warn(`P1 issues found (${p1Count}). See ${reportPath}`)
    return
  }

  console.log(`Locale parity check passed. Report: ${reportPath}`)
}

main()
