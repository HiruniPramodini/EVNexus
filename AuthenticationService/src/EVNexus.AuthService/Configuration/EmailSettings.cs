namespace EVNexus.AuthService.Configuration;

public class EmailSettings
{
    public const string SectionName = "EmailSettings";

    public string SmtpHost { get; set; } = "smtp.gmail.com";
    public int SmtpPort { get; set; } = 587;
    public string SenderEmail { get; set; } = "notifications@evnexus.io";
    public string SenderName { get; set; } = "EVNexus Platform";
    public string SenderPassword { get; set; } = "";
    public bool EnableSsl { get; set; } = true;
    public string FrontendBaseUrl { get; set; } = "http://localhost:3000";
}
