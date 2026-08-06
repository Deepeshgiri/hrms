import { environment } from "src/environments/environment"

export class AppConstants {
  public static get API_URL(): string {
    return environment.API_URL;
  }

  public static get WEBSITE_URL(): string {
    return environment.WEBSITE_URL;
  }

  public static get HRMS_ENDPOINTS() {
    return environment.HRMS_ENDPOINTS;
  }
}
