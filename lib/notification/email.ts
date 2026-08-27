/**
 * Global HRMS - Email Notification Service (Server-side)
 * 
 * IMPORTANT: This module is intended for server-side usage (API routes, server actions).
 * Private SMTP / API credentials must NEVER be exposed to client components.
 */

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface LeaveApprovedEmailParams {
  to: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  approverName?: string;
}

export interface LeaveRejectedEmailParams {
  to: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface EmployeeWelcomeEmailParams {
  to: string;
  employeeName: string;
  employeeId: string;
  tempPassword?: string;
  loginUrl?: string;
}

export interface PasswordChangedEmailParams {
  to: string;
  employeeName: string;
  timestamp?: string;
}

export interface PayrollProcessedEmailParams {
  to: string;
  employeeName: string;
  month: string;
  netSalary: string | number;
  payslipUrl?: string;
}

/**
 * Base responsive HTML email layout wrapper with Global HRMS branding
 */
export function createEmailLayout(content: string, title: string = "Global HRMS Notification"): string {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 24px;
      color: #334155;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #ffffff;
      padding: 28px 32px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .header p {
      margin: 6px 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .body {
      padding: 32px;
      font-size: 15px;
      line-height: 1.6;
      color: #1e293b;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #edf2f7;
      font-size: 14px;
    }
    .card-row:last-child {
      border-bottom: none;
    }
    .card-label {
      color: #64748b;
      font-weight: 500;
    }
    .card-value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 16px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .badge-success {
      background-color: #dcfce7;
      color: #15803d;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-danger {
      background-color: #fee2e2;
      color: #b91c1c;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Global HRMS</h1>
      <p>Human Resource Management System</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© ${currentYear} Global HRMS. All rights reserved.</p>
      <p>This is an automated system notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Core sendEmail dispatcher.
 * Integrates with SMTP / Resend / SendGrid via environment variables.
 * Falls back to safe mock logging in development/staging when credentials are not configured.
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  if (typeof window !== "undefined") {
    console.warn("[GlobalHRMS Email] sendEmail called on client-side. Please use API routes/server actions.");
    return {
      success: false,
      error: "Email service cannot be dispatched directly from the client.",
    };
  }

  try {
    const toAddress = Array.isArray(params.to) ? params.to.join(", ") : params.to;
    const fromAddress = params.from || process.env.EMAIL_FROM || "notifications@globalhrms.com";

    // 1. Resend Integration check
    if (process.env.RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: Array.isArray(params.to) ? params.to : [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Resend API Error: ${JSON.stringify(errData)}`);
      }

      const data = await response.json();
      return { success: true, messageId: data.id };
    }

    // 2. SendGrid Integration check
    if (process.env.SENDGRID_API_KEY) {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: (Array.isArray(params.to) ? params.to : [params.to]).map((email) => ({ email })),
            },
          ],
          from: { email: fromAddress },
          subject: params.subject,
          content: [{ type: "text/html", value: params.html }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`SendGrid API Error: ${errText}`);
      }

      return { success: true, messageId: `sg-${Date.now()}` };
    }

    // 3. Fallback / Local Development Mock Dispatcher
    const mockId = `mock-email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[GlobalHRMS Email Service] Sent email successfully:`);
      console.log(`  To: ${toAddress}`);
      console.log(`  Subject: ${params.subject}`);
      console.log(`  Message ID: ${mockId}`);
    }

    return {
      success: true,
      messageId: mockId,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send email";
    console.error("[GlobalHRMS Email Service Error]:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ==========================================
// HRMS-SPECIFIC EMAIL NOTIFICATION HELPERS
// ==========================================

/**
 * Send email when a leave request is approved
 */
export async function sendLeaveApprovedEmail(params: LeaveApprovedEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Leave Request Approved</h2>
    <p>Dear <strong>${params.employeeName}</strong>,</p>
    <p>We are pleased to inform you that your leave request has been <span class="badge-success">APPROVED</span>.</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr class="card-row">
          <td class="card-label">Leave Type:</td>
          <td class="card-value">${params.leaveType}</td>
        </tr>
        <tr class="card-row">
          <td class="card-label">Duration:</td>
          <td class="card-value">${params.startDate} to ${params.endDate}</td>
        </tr>
        ${
          params.approverName
            ? `<tr class="card-row">
                <td class="card-label">Approved By:</td>
                <td class="card-value">${params.approverName}</td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <p>Enjoy your time off. For any queries, please get in touch with your HR department.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Leave Request Approved - ${params.leaveType}`,
    html: createEmailLayout(content, "Leave Approved"),
  });
}

/**
 * Send email when a leave request is rejected
 */
export async function sendLeaveRejectedEmail(params: LeaveRejectedEmailParams): Promise<EmailResult> {
  const content = `
    <h2>Leave Request Update</h2>
    <p>Dear <strong>${params.employeeName}</strong>,</p>
    <p>This is to inform you that your leave request has been <span class="badge-danger">REJECTED</span>.</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr class="card-row">
          <td class="card-label">Leave Type:</td>
          <td class="card-value">${params.leaveType}</td>
        </tr>
        <tr class="card-row">
          <td class="card-label">Requested Dates:</td>
          <td class="card-value">${params.startDate} to ${params.endDate}</td>
        </tr>
        ${
          params.reason
            ? `<tr class="card-row">
                <td class="card-label">Reason:</td>
                <td class="card-value" style="color: #b91c1c;">${params.reason}</td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <p>If you have questions regarding this decision, please speak directly with your reporting manager or HR team.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Leave Request Update - ${params.leaveType}`,
    html: createEmailLayout(content, "Leave Request Update"),
  });
}

/**
 * Send welcome email when a new employee is created
 */
export async function sendEmployeeWelcomeEmail(params: EmployeeWelcomeEmailParams): Promise<EmailResult> {
  const loginUrl = params.loginUrl || process.env.NEXTAUTH_URL || "https://globalhrms.com/login";

  const content = `
    <h2>Welcome to Global HRMS!</h2>
    <p>Dear <strong>${params.employeeName}</strong>,</p>
    <p>Welcome to our team! Your Global HRMS account has been successfully created.</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr class="card-row">
          <td class="card-label">Employee ID:</td>
          <td class="card-value">${params.employeeId}</td>
        </tr>
        <tr class="card-row">
          <td class="card-label">Official Email / Username:</td>
          <td class="card-value">${params.to}</td>
        </tr>
        ${
          params.tempPassword
            ? `<tr class="card-row">
                <td class="card-label">Temporary Password:</td>
                <td class="card-value" style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${params.tempPassword}</td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <p>Please log in and update your profile and password immediately upon first access.</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="${loginUrl}" class="btn">Log in to Global HRMS</a>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: "Welcome to Global HRMS - Account Activation",
    html: createEmailLayout(content, "Welcome to Global HRMS"),
  });
}

/**
 * Send email when user password is changed
 */
export async function sendPasswordChangedEmail(params: PasswordChangedEmailParams): Promise<EmailResult> {
  const timestamp = params.timestamp || new Date().toLocaleString();

  const content = `
    <h2>Security Alert: Password Changed</h2>
    <p>Dear <strong>${params.employeeName}</strong>,</p>
    <p>The password for your Global HRMS account was successfully changed on <strong>${timestamp}</strong>.</p>
    
    <div class="card">
      <p style="margin: 0; color: #b91c1c; font-size: 13px; font-weight: 500;">
        ⚠️ If you did not make this change, please contact your HR administrator or IT security team immediately.
      </p>
    </div>

    <p>Thank you for keeping your account secure.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: "Security Notification: Password Changed",
    html: createEmailLayout(content, "Password Changed"),
  });
}

/**
 * Send email when payroll has been processed and payslip is ready
 */
export async function sendPayrollProcessedEmail(params: PayrollProcessedEmailParams): Promise<EmailResult> {
  const formattedSalary =
    typeof params.netSalary === "number"
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(params.netSalary)
      : params.netSalary;

  const content = `
    <h2>Payroll Processed - ${params.month}</h2>
    <p>Dear <strong>${params.employeeName}</strong>,</p>
    <p>Your salary for the month of <strong>${params.month}</strong> has been processed successfully.</p>
    
    <div class="card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr class="card-row">
          <td class="card-label">Payroll Month:</td>
          <td class="card-value">${params.month}</td>
        </tr>
        <tr class="card-row">
          <td class="card-label">Net Salary:</td>
          <td class="card-value" style="color: #15803d; font-size: 16px;">${formattedSalary}</td>
        </tr>
      </table>
    </div>

    ${
      params.payslipUrl
        ? `<div style="text-align: center; margin: 24px 0;">
            <a href="${params.payslipUrl}" class="btn">View / Download Payslip</a>
          </div>`
        : `<p>You can view and download your payslip anytime from your Global HRMS Employee Portal.</p>`
    }
  `;

  return sendEmail({
    to: params.to,
    subject: `Payslip Available for ${params.month}`,
    html: createEmailLayout(content, `Payslip - ${params.month}`),
  });
}
