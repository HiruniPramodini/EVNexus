namespace EVNexus.AuthService.Exceptions;

public class DuplicateEmailException : Exception
{
    public DuplicateEmailException() { }

    public DuplicateEmailException(string email)
        : base($"A company with the business email '{email}' is already registered.")
    {
    }

    public DuplicateEmailException(string email, Exception innerException)
        : base($"A company with the business email '{email}' is already registered.", innerException)
    {
    }
}

public class DuplicateRegistrationNumberException : Exception
{
    public DuplicateRegistrationNumberException() { }

    public DuplicateRegistrationNumberException(string regNumber)
        : base($"A company with registration number '{regNumber}' is already registered.")
    {
    }

    public DuplicateRegistrationNumberException(string regNumber, Exception innerException)
        : base($"A company with registration number '{regNumber}' is already registered.", innerException)
    {
    }
}
