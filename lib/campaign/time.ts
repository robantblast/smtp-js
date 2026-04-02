export function timezoneSet(timezone: string, token: string): string {
  const options: Intl.DateTimeFormatOptions = { timeZone: timezone };

  switch (token) {
    case "H":
      options.hour = "2-digit";
      options.hour12 = false;
      break;
    case "h":
      options.hour = "2-digit";
      break;
    case "i":
      options.minute = "2-digit";
      break;
    case "s":
      options.second = "2-digit";
      return String(new Date().getSeconds()).padStart(2, "0");
    case "d":
      options.day = "numeric";
      break;
    case "m":
      options.month = "long";
      break;
    case "Y":
      options.year = "numeric";
      break;
    case "full":
      options.day = "numeric";
      options.month = "long";
      options.year = "numeric";
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.second = "2-digit";
      break;
    case "full2":
      options.day = "numeric";
      options.month = "numeric";
      options.year = "numeric";
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.second = "2-digit";
      break;
    case "jdate":
      options.weekday = "short";
      options.day = "numeric";
      options.month = "long";
      options.year = "numeric";
      break;
    case "jdate2":
      options.day = "numeric";
      options.month = "numeric";
      options.year = "numeric";
      break;
    case "fulltime24":
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.second = "2-digit";
      options.hour12 = false;
      break;
    case "fulltime12":
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.second = "2-digit";
      break;
    default:
      break;
  }

  return new Date().toLocaleString("en-us", options);
}
