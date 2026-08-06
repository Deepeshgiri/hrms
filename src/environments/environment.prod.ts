export const environment = {
  production: true,
  API_URL: "https://api.pinnacloeducare.com/exam/",
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
