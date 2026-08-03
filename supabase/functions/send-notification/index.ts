import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/auth.ts";
import { extractIp, recordAudit } from "../_shared/audit.ts";
import { validateSendNotificationInput, type SendNotificationInput } from "../_shared/validation.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  const corsHeaders = getCorsHeaders(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse and validate input
    const body = await req.json();
    const validation = validateSendNotificationInput(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = validation.data;
    const { alert_type, recipient, template, channel, shop_id } = payload;

    // Verify caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller has access to the requested shop
    const userClient = createClient(
      Deno.env.get("URL")!,
      Deno.env.get("ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check shop membership
    const { data: membership } = await userClient
      .from("shop_memberships")
      .select("shop_id")
      .eq("user_id", user.id)
      .eq("shop_id", shop_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden: no access to this shop" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createAdminClient();

    // Get notification service config for this shop and channel
    const { data: config, error: configError } = await adminClient
      .from("notification_service_config")
      .select("*")
      .eq("shop_id", shop_id)
      .eq("service_type", channel === "email" ? "email" : "sms")
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `No active ${channel} service configured for this shop`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result: { success: boolean; messageId?: string; error?: string };

    if (channel === "email") {
      result = await sendEmail(config, recipient, template);
    } else {
      result = await sendSMS(config, recipient, template);
    }

    // Record audit log
    await recordAudit(adminClient, {
      actorId: "system",
      action: "send_notification",
      targetType: "alert",
      targetId: alert_type,
      shopId: shop_id,
      details: {
        channel,
        recipient: { email: recipient.email, phone: recipient.phone, name: recipient.name },
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      },
      ipAddress: extractIp(req),
    });

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Unhandled error in send-notification:", msg, err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function sendEmail(
  config: { service_name: string; config_data: Record<string, unknown> },
  recipient: { email?: string; name: string },
  template: { subject?: string; body: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { service_name, config_data } = config;

  if (!recipient.email) {
    return { success: false, error: "Recipient email is required" };
  }

  try {
    switch (service_name) {
      case "sendgrid":
        return await sendViaSendGrid(config_data, recipient.email, template);
      case "aws_ses":
        // ponytail: AWS SES removed — only SendGrid supported. Add SES when requested with proper SigV4.
        return { success: false, error: "AWS SES not supported. Use SendGrid instead." };
      default:
        return { success: false, error: `Unsupported email service: ${service_name}` };
    }
  } catch (error) {
    return { success: false, error: "Email send failed" };
  }
}

async function sendViaSendGrid(
  configData: Record<string, unknown>,
  to: string,
  template: { subject?: string; body: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = configData.apiKey as string;
  const fromEmail = configData.fromEmail as string;

  if (!apiKey || !fromEmail) {
    return { success: false, error: "SendGrid configuration incomplete" };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail },
      subject: template.subject || "Alert",
      content: [{ type: "text/html", value: template.body }],
    }),
  });

  if (response.ok) {
    const messageId = response.headers.get("X-Message-Id") || "unknown";
    return { success: true, messageId };
  } else {
    const error = await response.text();
    console.error("SendGrid error:", error);
    return { success: false, error: "Email delivery failed" };
  }
}

async function sendSMS(
  config: { service_name: string; config_data: Record<string, unknown> },
  recipient: { phone?: string; name: string },
  template: { subject?: string; body: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { service_name, config_data } = config;

  if (!recipient.phone) {
    return { success: false, error: "Recipient phone is required" };
  }

  try {
    if (service_name === "twilio") {
      return await sendViaTwilio(config_data, recipient.phone, template.body);
    } else {
      return { success: false, error: `Unsupported SMS service: ${service_name}` };
    }
  } catch (error) {
    return { success: false, error: `SMS send failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function sendViaTwilio(
  configData: Record<string, unknown>,
  to: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = configData.accountSid as string;
  const authToken = configData.authToken as string;
  const fromNumber = configData.fromNumber as string;

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio configuration incomplete" };
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return { success: true, messageId: data.sid };
  } else {
    const error = await response.text();
    console.error("Twilio error:", error);
    return { success: false, error: "SMS delivery failed" };
  }
}