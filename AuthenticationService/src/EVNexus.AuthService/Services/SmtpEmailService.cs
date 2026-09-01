using System.Net;
using System.Net.Mail;
using System.Text;
using EVNexus.AuthService.Configuration;
using Microsoft.Extensions.Options;

namespace EVNexus.AuthService.Services;

public class SmtpEmailService : IEmailService
{
    private readonly EmailSettings _settings;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IOptions<EmailSettings> options, ILogger<SmtpEmailService> logger)
    {
        _settings = options.Value ?? new EmailSettings();
        _logger = logger;
    }

    public async Task<bool> SendVerificationEmailAsync(
        string recipientEmail,
        string recipientName,
        string verificationCode,
        string verificationLink,
        CancellationToken cancellationToken = default)
    {
        var subject = $"Verify your EVNexus Account — Code: {verificationCode}";
        
        // Build absolute frontend verification link if relative
        var fullVerificationLink = verificationLink.StartsWith("http", StringComparison.OrdinalIgnoreCase)
            ? verificationLink
            : $"{_settings.FrontendBaseUrl.TrimEnd('/')}/{verificationLink.TrimStart('/')}";

        var htmlBody = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"" />
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
  <title>Verify your EVNexus Account</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
    }}
    .email-container {{
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }}
    .header {{
      background: linear-gradient(135deg, #0284c7 0%, #1e40af 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }}
    .header h1 {{
      margin: 0 0 6px 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }}
    .header p {{
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }}
    .content {{
      padding: 32px 28px;
    }}
    .greeting {{
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }}
    .message {{
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }}
    .code-box {{
      background: #f0f9ff;
      border: 2px dashed #0284c7;
      border-radius: 10px;
      padding: 18px 24px;
      text-align: center;
      margin: 24px 0;
    }}
    .code-label {{
      font-size: 12px;
      font-weight: 700;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }}
    .code-value {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      color: #0284c7;
      letter-spacing: 6px;
      margin: 0;
    }}
    .btn-container {{
      text-align: center;
      margin: 28px 0;
    }}
    .verify-btn {{
      display: inline-block;
      background: linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
    }}
    .expiry-note {{
      font-size: 13px;
      color: #64748b;
      text-align: center;
      margin-top: 18px;
      line-height: 1.4;
    }}
    .footer {{
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }}
  </style>
</head>
<body>
  <div class=""email-container"">
    <div class=""header"">
      <h1>⚡ EVNexus Platform</h1>
      <p>Smart Electric Vehicle Management & Charging Network</p>
    </div>
    <div class=""content"">
      <div class=""greeting"">Hello {WebUtility.HtmlEncode(recipientName)},</div>
      <div class=""message"">
        Thank you for registering with <strong>EVNexus</strong>. To activate your account and unlock complete platform access (charging station operations, tariff settings, and smart charging sessions), please verify your email address.
      </div>
      <div class=""code-box"">
        <div class=""code-label"">Your 6-Digit Verification Code</div>
        <div class=""code-value"">{verificationCode}</div>
      </div>
      <div class=""btn-container"">
        <a href=""{fullVerificationLink}"" class=""verify-btn"" target=""_blank"">Verify Email Address Now</a>
      </div>
      <div class=""expiry-note"">
        ⏳ <strong>Security Notice:</strong> This code and verification link will expire in <strong>24 hours</strong>.<br/>
        If you did not create an account with EVNexus, please disregard this email.
      </div>
    </div>
    <div class=""footer"">
      &copy; 2026 EVNexus Enterprise Inc. • Distributed EV Ecosystem<br/>
      Need assistance? Contact support@evnexus.io
    </div>
  </div>
</body>
</html>";

        var plainText = $"Hello {recipientName},\n\n" +
                        $"Welcome to EVNexus! Please verify your email address to unlock full platform access.\n\n" +
                        $"Your 6-Digit Verification Code is: {verificationCode}\n\n" +
                        $"Or verify directly by opening this link in your browser:\n" +
                        $"{fullVerificationLink}\n\n" +
                        $"This code expires in 24 hours.\n\n" +
                        $"- The EVNexus Team";

        return await SendEmailAsync(recipientEmail, subject, htmlBody, plainText, cancellationToken);
    }

    public async Task<bool> SendEmailChangeVerificationCodeAsync(
        string recipientEmail,
        string recipientName,
        string verificationCode,
        CancellationToken cancellationToken = default)
    {
        var subject = $"EVNexus Email Change Request — Code: {verificationCode}";

        var htmlBody = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"" />
  <style>
    body {{ font-family: Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }}
    .box {{ max-width: 540px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 28px; border: 1px solid #e2e8f0; }}
    .code {{ font-family: monospace; font-size: 32px; font-weight: bold; color: #0284c7; letter-spacing: 4px; text-align: center; margin: 20px 0; }}
  </style>
</head>
<body>
  <div class=""box"">
    <h2>EVNexus Email Change Request</h2>
    <p>Hello {WebUtility.HtmlEncode(recipientName)},</p>
    <p>We received a request to update the business email address associated with your EVNexus organization to <strong>{WebUtility.HtmlEncode(recipientEmail)}</strong>.</p>
    <p>Please enter the following 6-digit confirmation code in your dashboard to authorize this change:</p>
    <div class=""code"">{verificationCode}</div>
    <p style=""font-size: 13px; color: #64748b;"">This code is valid for 15 minutes. If you did not initiate this change, please contact support immediately.</p>
  </div>
</body>
</html>";

        var plainText = $"Hello {recipientName},\n\n" +
                        $"Your verification code for updating your EVNexus email is: {verificationCode}\n\n" +
                        $"This code is valid for 15 minutes.";

        return await SendEmailAsync(recipientEmail, subject, htmlBody, plainText, cancellationToken);
    }

    private async Task<bool> SendEmailAsync(
        string recipientEmail,
        string subject,
        string htmlBody,
        string plainTextBody,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            _logger.LogWarning("Email delivery skipped: recipient email is null or empty.");
            return false;
        }

        // Check if SMTP is configured
        var hasSmtpPassword = !string.IsNullOrWhiteSpace(_settings.SenderPassword);

        _logger.LogInformation("================================================================================");
        _logger.LogInformation("📨 [EMAIL DISPATCH] To: {RecipientEmail} | Subject: {Subject}", recipientEmail, subject);
        _logger.LogInformation("SMTP Configuration: Host={Host}:{Port}, SSL={Ssl}, From={SenderEmail}, AuthEnabled={HasAuth}",
            _settings.SmtpHost, _settings.SmtpPort, _settings.EnableSsl, _settings.SenderEmail, hasSmtpPassword);

        if (!hasSmtpPassword)
        {
            _logger.LogInformation("💡 [DEV NOTE] SenderPassword is empty in EmailSettings. Email logged in console (set SenderPassword in appsettings.json for live SMTP delivery to real inboxes).");
            _logger.LogInformation("Email Body (Plain Text):\n{PlainText}", plainTextBody);
            _logger.LogInformation("================================================================================");
            return true;
        }

        try
        {
            using var mailMessage = new MailMessage();
            mailMessage.From = new MailAddress(_settings.SenderEmail, _settings.SenderName, Encoding.UTF8);
            mailMessage.To.Add(new MailAddress(recipientEmail.Trim()));
            mailMessage.Subject = subject;
            mailMessage.SubjectEncoding = Encoding.UTF8;
            mailMessage.BodyEncoding = Encoding.UTF8;
            mailMessage.IsBodyHtml = true;
            mailMessage.Body = htmlBody;

            // Plain text alternate view
            var plainView = AlternateView.CreateAlternateViewFromString(plainTextBody, Encoding.UTF8, "text/plain");
            mailMessage.AlternateViews.Add(plainView);

            var htmlView = AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, "text/html");
            mailMessage.AlternateViews.Add(htmlView);

            using var client = new SmtpClient(_settings.SmtpHost, _settings.SmtpPort)
            {
                EnableSsl = _settings.EnableSsl,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_settings.SenderEmail, _settings.SenderPassword),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 15000
            };

            await client.SendMailAsync(mailMessage, cancellationToken);

            _logger.LogInformation("✅ [EMAIL SENT SUCCESSFULLY] Email delivered to {RecipientEmail} via SMTP ({Host}:{Port})",
                recipientEmail, _settings.SmtpHost, _settings.SmtpPort);
            _logger.LogInformation("================================================================================");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ [EMAIL SEND FAILED] Failed to send email to {RecipientEmail} via SMTP ({Host}:{Port}): {Message}",
                recipientEmail, _settings.SmtpHost, _settings.SmtpPort, ex.Message);
            _logger.LogInformation("Fallback - Verification code was generated and logged above.");
            _logger.LogInformation("================================================================================");
            return false;
        }
    }
}
