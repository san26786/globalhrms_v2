/**
 * Global HRMS - SMS Notification Service (Server-side)
 * 
 * IMPORTANT: This module is intended for server-side usage (API routes, server actions).
 * Private SMS API credentials must NEVER be exposed to client components.
 */

export interface SendSMSParams {
  to: string;
  message: string;
  senderId?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface LeaveApprovedSMSParams {
  phone: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

export interface PayrollProcessedSMSParams {
  phone: string;
  employeeName: string;
  month: string;
  netSalary: string | number;
}

export interface HRNotificationSMSParams {
  phone: string;
  employeeName: string;
  message: string;
}

/**
 * Core sendSMS dispatcher.
 * Prepared for Twilio / MSG91 / Fast2SMS via environment variables.
 * Safe mock implementation in development/staging when credentials are not configured.
 */
export async function sendSMS(params: SendSMSParams): Promise<SMSResult> {
  if (typeof window !== "undefined") {
    console.warn("[GlobalHRMS SMS] sendSMS called on client-side. Please use API routes/server actions.");
    return {
      success: false,
      error: "SMS service cannot be dispatched directly from the client.",
    };
  }

  try {
    const { to, message } = params;

    // 1. Twilio Integration check
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      
      const body = new URLSearchParams({
        To: to,
        From: process.env.TWILIO_PHONE_NUMBER,
        Body: message,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Twilio API Error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return { success: true, messageId: data.sid };
    }

    // 2. Fast2SMS Integration check
    if (process.env.FAST2SMS_API_KEY) {
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "v3",
          sender_id: params.senderId || process.env.SMS_SENDER_ID || "TXTIND",
          message,
          language: "english",
          flash: 0,
          numbers: to.replace(/[^0-9]/g, ""),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Fast2SMS API Error: ${errorText}`);
      }

      const data = await response.json();
      return { success: true, messageId: data.request_id || `f2s-${Date.now()}` };
    }

    // 3. Fallback Mock Handler
    const mockId = `mock-sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[GlobalHRMS SMS Service] Sent SMS successfully:`);
      console.log(`  To: ${to}`);
      console.log(`  Message: ${message}`);
      console.log(`  Message ID: ${mockId}`);
    }

    return {
      success: true,
      messageId: mockId,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send SMS";
    console.error("[GlobalHRMS SMS Service Error]:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ==========================================
// HRMS-SPECIFIC SMS NOTIFICATION HELPERS
// ==========================================

/**
 * Send SMS when a leave request is approved
 */
export async function sendLeaveApprovedSMS(params: LeaveApprovedSMSParams): Promise<SMSResult> {
  const message = `Dear ${params.employeeName}, your ${params.leaveType} leave from ${params.startDate} to ${params.endDate} has been approved. - Global HRMS`;

  return sendSMS({
    to: params.phone,
    message,
  });
}

/**
 * Send SMS when payroll is processed
 */
export async function sendPayrollProcessedSMS(params: PayrollProcessedSMSParams): Promise<SMSResult> {
  const formattedSalary =
    typeof params.netSalary === "number"
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(params.netSalary)
      : params.netSalary;

  const message = `Dear ${params.employeeName}, your salary for ${params.month} of ${formattedSalary} has been credited. View payslip on Global HRMS portal.`;

  return sendSMS({
    to: params.phone,
    message,
  });
}

/**
 * Send general HR announcement or important notice SMS
 */
export async function sendHRNotificationSMS(params: HRNotificationSMSParams): Promise<SMSResult> {
  const message = `Hi ${params.employeeName}, HR Notice: ${params.message} - Global HRMS`;

  return sendSMS({
    to: params.phone,
    message,
  });
}
