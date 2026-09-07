namespace EVNexus.AuthService.Services;

public interface IEmailService
{
    Task<bool> SendVerificationEmailAsync(
        string recipientEmail,
        string recipientName,
        string verificationCode,
        string verificationLink,
        CancellationToken cancellationToken = default);

    Task<bool> SendEmailChangeVerificationCodeAsync(
        string recipientEmail,
        string recipientName,
        string verificationCode,
        CancellationToken cancellationToken = default);
}
