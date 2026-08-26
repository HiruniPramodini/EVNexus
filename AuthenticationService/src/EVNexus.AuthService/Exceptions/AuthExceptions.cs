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

public class InvalidCredentialsException : Exception
{
    public InvalidCredentialsException(string message = "Invalid email or password.")
        : base(message)
    {
    }

    public InvalidCredentialsException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

public class TenantNotFoundException : Exception
{
    public TenantNotFoundException(string tenantId)
        : base($"Company with Tenant ID '{tenantId}' was not found.")
    {
    }
}

public class DriverNotFoundException : Exception
{
    public DriverNotFoundException(string driverId)
        : base($"Driver with Driver ID '{driverId}' was not found.")
    {
    }
}

public class CrossTenantAccessException : Exception
{
    public CrossTenantAccessException(string message = "Cross-tenant access forbidden. You cannot access or modify data belonging to another tenant.")
        : base(message)
    {
    }

    public CrossTenantAccessException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
