export const environment = {
  production: false,
  API_URL: "http://localhost:40010/exam/",
  WEBSITE_URL: "https://www.pinnacloeducare.com/",
  
  MULTI_TENANT: true,
  TENANT_MODE: 'subdomain',
  DEFAULT_TENANT: null,
  
  HRMS_ENDPOINTS: {
    leaves: 'leaves',
    hr: 'hr',
    hrmsReports: 'hrms-reports',
    fees: 'fees',
    bio: 'bio'
  },
  
  getApiUrl: () => environment.API_URL
};
