export interface SubModule {
  name: string;
}

export interface ModuleMenu {
  name: string;
  subModules: SubModule[];
}

export const menuHierarchy: ModuleMenu[] = [
  {
    name: "Dashboard",
    subModules: [
      { name: "Employee Dashboard" },
      { name: "Attendance Dashboard" },
      { name: "Leave Dashboard" },
      { name: "Timesheet Dashboard" },
      { name: "Dashboard" },
      { name: "abg" }
    ]
  },
  {
    name: "Employee Hub",
    subModules: [
      { name: "Address" },
      { name: "Bank Accounts" },
      { name: "Confirmation Pending" },
      { name: "Dependent" },
      { name: "Education" },
      { name: "Emergency Contacts" },
      { name: "Employee Email" },
      { name: "Employee Manager" },
      { name: "Employee Phone" },
      { name: "Employee Reporting" },
      { name: "Employee Termination" },
      { name: "Employment Application" },
      { name: "Exit and Clearance Formality" },
      { name: "Investment Details" },
      { name: "Job Detail" },
      { name: "Languages Known" },
      { name: "Licences" },
      { name: "Member Documents" },
      { name: "Membership" },
      { name: "My Picture" },
      { name: "Nationality" },
      { name: "Regulatory Requirement" },
      { name: "Salary Details" },
      { name: "Team Employee Manager" },
      { name: "Work Experience" },
      { name: "Work Locations" },
      { name: "Work Shifts" }
    ]
  },
  {
    name: "Attendance",
    subModules: [
      { name: "Punch In-Out" },
      { name: "Daily Attendance" },
      { name: "My Attendance Log" },
      { name: "My Team Attendance Log" },
      { name: "My Team Attendance Register" },
      { name: "Attendance Register" },
      { name: "Monthly Register" },
      { name: "My Team Monthly Register" },
      { name: "Adhoc Punch Requests" },
      { name: "Attendance Calendar Event List" },
      { name: "Attendance Holiday Calendar" },
      { name: "Employee Info" },
      { name: "Punch Monitor" },
      { name: "Sync Attendance" },
      { name: "Team Details" }
    ]
  },
  {
    name: "Leave",
    subModules: [
      { name: "My Leave Request" },
      { name: "My Pending Leave" },
      { name: "My Approved Leave" },
      { name: "My Rejected Leave" },
      { name: "My Leave Cancellation" },
      { name: "My leave Details" },
      { name: "My Team Leave Request" },
      { name: "My Team Pending Leave" },
      { name: "My Team Approved Leave" },
      { name: "My Team Rejected Leave" },
      { name: "My Team Cancelled Leave" },
      { name: "Employee Info" },
      { name: "Employee Leave Entitlement" },
      { name: "Employee Leave Summary" },
      { name: "Employee Status" },
      { name: "Leave Allocation Adhoc" },
      { name: "Leave Cancellation" },
      { name: "Leave Designation Setting" },
      { name: "Leave Encash" },
      { name: "Leave Monthly Credit" },
      { name: "Leave Period Details" },
      { name: "Leave Report" },
      { name: "Leave Request" },
      { name: "Leave Sanction" },
      { name: "Leave Setting" },
      { name: "Leave Type Config" },
      { name: "Team Details" },
      { name: "Team Leave Request" }
    ]
  },
  {
    name: "Timesheet",
    subModules: [
      { name: "My Timesheet" },
      { name: "New Timesheet Item" },
      { name: "Submit for Approval Timesheet" },
      { name: "Approved Timesheets" },
      { name: "Pending Approval Timesheets" },
      { name: "Rejected Timesheets" },
      { name: "Team Timesheets" },
      { name: "Team Approved Timesheets" },
      { name: "Team Pending Approval Timesheets" },
      { name: "Team Rejected Timesheets" },
      { name: "Configure Projects" },
      { name: "Configure Tasks" },
      { name: "Delayed Timsheet Allowance" },
      { name: "Employee Info" },
      { name: "Manage Timesheet" },
      { name: "Team Details" },
      { name: "Timesheet Audit" },
      { name: "Timesheet Item" },
      { name: "Timesheet Period Details" },
      { name: "Test" }
    ]
  },
  {
    name: "Sales Order",
    subModules: [
      { name: "Sales Order" }
    ]
  },
  {
    name: "Purchase Order",
    subModules: [
      { name: "Purchase Order" }
    ]
  },
  {
    name: "Bank Manager",
    subModules: [
      { name: "Bank Account Details" },
      { name: "Bank Name Master" },
      { name: "Bank Statement Setting" },
      { name: "Bank Transaction" }
    ]
  },
  {
    name: "Bills",
    subModules: [
      { name: "Bill" },
      { name: "Bill Payment" },
      { name: "Debit Memo" },
      { name: "Payout" },
      { name: "Supplier Projects" }
    ]
  },
  {
    name: "Invoicing",
    subModules: [
      { name: "Invoice" },
      { name: "Credit Note" },
      { name: "Invoice Scheduler" },
      { name: "Project Details" },
      { name: "Receipt" },
      { name: "Remittance" }
    ]
  },
  {
    name: "Expenses Manager",
    subModules: [
      { name: "Expenses" },
      { name: "Expenses Drafted" },
      { name: "Expenses Employee" },
      { name: "Expenses Request For Approval" },
      { name: "Approved Expenses" },
      { name: "Expenses Rejected" }
    ]
  },
  {
    name: "Payroll",
    subModules: [
      { name: "My Payslips" },
      { name: "My Annexures" },
      { name: "Advance Salary" },
      { name: "Salary Breakup" },
      { name: "Component Wise Salary Breakup" },
      { name: "Payroll Processing" },
      { name: "Professional Tax" },
      { name: "Salary Bank Transfer Report" },
      { name: "Monthly Net Report" },
      { name: "Monthly Gross Report" },
      { name: "Annually Pay Summary" },
      { name: "Daily Pay Summary" },
      { name: "Weekly Pay Summary" },
      { name: "Monthly Pay Summary" },
      { name: "Annexure Processing" },
      { name: "Employee Details" },
      { name: "Form 16" },
      { name: "Incentive" },
      { name: "Outdoor Allowance Details" },
      { name: "Payroll Attendance Summary" }
    ]
  },
  {
    name: "Performance",
    subModules: [
      { name: "My Performance Review" },
      { name: "My Performance Accepted" },
      { name: "My Performance Rejected" },
      { name: "My Team Performance Review" },
      { name: "My Team Performance Approved" },
      { name: "My Team Performance Rejected" },
      { name: "My Team Employee Submitted" },
      { name: "My Team Goal Defined" },
      { name: "My Team Manager Submitted" },
      { name: "Custom Party" },
      { name: "Employee Info" },
      { name: "Employee Submitted" },
      { name: "Goal Defined" },
      { name: "Manager Submitted" },
      { name: "Performance Action Log" },
      { name: "Performance Indicator" },
      { name: "Performance Item" },
      { name: "Performance Period Details" },
      { name: "Performance Rating" },
      { name: "Performance Review Comments" },
      { name: "Team Details" }
    ]
  },
  {
    name: "Recruitment",
    subModules: [
      { name: "Candidate Master" },
      { name: "Vacancy Master" },
      { name: "Job Application Master" },
      { name: "Applicant Details" },
      { name: "Interview Master" },
      { name: "Interviewer Comments" },
      { name: "Job offered to Candidate" },
      { name: "Job Appointed Candidate" },
      { name: "Close Vacancy" },
      { name: "Activities" },
      { name: "Calendar" },
      { name: "Candidate Education" },
      { name: "Candidate History" },
      { name: "Candidate Other Info" },
      { name: "Candidate Reference" },
      { name: "Candidate Work Experience" },
      { name: "Recruitment Attachment" },
      { name: "Reports" }
    ]
  },
  {
    name: "Asset Manager",
    subModules: [
      { name: "Asset Manager" },
      { name: "Asset Register" },
      { name: "Asset Master" },
      { name: "Asset Employee" },
      { name: "Asset Services" },
      { name: "Asset Attribute" },
      { name: "Asset Attribute Master" },
      { name: "Asset Depreciation" },
      { name: "Asset Finance" },
      { name: "Issue" },
      { name: "Returns" }
    ]
  },
  {
    name: "Policy Manager",
    subModules: [
      { name: "Policy Document" },
      { name: "Policy Document Category" },
      { name: "Policy Document Upload" }
    ]
  },
  {
    name: "Document Management",
    subModules: [
      { name: "Document Management System" },
      { name: "My Documents" }
    ]
  },
  {
    name: "Support",
    subModules: [
      { name: "Ticket" },
      { name: "Open Tickets" },
      { name: "Assign Tickets" },
      { name: "Resolved Tickets" },
      { name: "Closed Tickets" },
      { name: "Online Chat Support" },
      { name: "Email Support" },
      { name: "Phone Support" },
      { name: "Feedback" },
      { name: "Link Support To Org" },
      { name: "Ticket Priority Config" },
      { name: "Ticket Statics Topic" },
      { name: "Ticket Statistics" },
      { name: "Ticket Status Config" },
      { name: "Ticket Thread" }
    ]
  },
  {
    name: "Survey",
    subModules: [
      { name: "Survey Master" },
      { name: "Survey Details" },
      { name: "Survey Question Bank" },
      { name: "Survey Question Master" },
      { name: "Survey Answer Options" }
    ]
  },
  {
    name: "Late Coming",
    subModules: [
      { name: "Late Coming Rules" },
      { name: "Late Coming Daily Summary" },
      { name: "Late Coming Weekly Summary" },
      { name: "Late Coming Monthly Summary" },
      { name: "Late Coming Team Daily Summary" },
      { name: "Late Coming Team Weekly Summary" },
      { name: "Late Coming Team Monthly Summary" }
    ]
  },
  {
    name: "Over Time",
    subModules: [
      { name: "OT Rules" },
      { name: "OT Daily Summary" },
      { name: "OT Weekly Summary" },
      { name: "OT Monthly Summary" },
      { name: "OT Summary" },
      { name: "OT Team Daily Summary" },
      { name: "OT Team Weekly Summary" },
      { name: "OT Team Monthly Summary" }
    ]
  },
  {
    name: "Outdoor Entries",
    subModules: [
      { name: "My Outdoor Entries Request" },
      { name: "My Pending Outdoor Entries" },
      { name: "My Approved Outdoor Entries" },
      { name: "My Rejected Outdoor Entry" },
      { name: "My Team Outdoor Entries Request" },
      { name: "My Team Outdoor Entries Pending" },
      { name: "My Team Outdoor Entries Approved" },
      { name: "My Team Outdoor Entries Rejected" },
      { name: "Today Outdoor Entries" },
      { name: "Approved Outdoor Entries" },
      { name: "Pending Outdoor Entries" },
      { name: "Rejected Outdoor Entries" },
      { name: "Adhoc Allocation" },
      { name: "Employee Info" },
      { name: "Outdoor Entries Type" },
      { name: "Outdoor Entry Quota" },
      { name: "Outdoor Period Details" },
      { name: "Team Details" }
    ]
  },
  {
    name: "Mileage",
    subModules: [
      { name: "My Mileage Requests" },
      { name: "My Pending Mileage" },
      { name: "My Approved Mileage" },
      { name: "My Rejected Mileage" },
      { name: "My Team Mileage Requests" },
      { name: "My Team Pending Mileage" },
      { name: "My Team Approved Mileage" },
      { name: "My Team Rejected Mileages" },
      { name: "Vehicle Master" },
      { name: "Mileage Claims" },
      { name: "Mileage Summary" },
      { name: "Mileage Rates" },
      { name: "Mileage Unit" },
      { name: "Body Type" },
      { name: "Colour" },
      { name: "Employee Info" },
      { name: "Fuel Type" },
      { name: "Gearbox Type" },
      { name: "Rate Type" },
      { name: "Rate Unit" },
      { name: "Team Details" },
      { name: "Vehicle Status Type" },
      { name: "Vehicle Type" }
    ]
  },
  {
    name: "Work Shift And Rota",
    subModules: [
      { name: "Rota" },
      { name: "Rota Day View" },
      { name: "Rota Manager" },
      { name: "Rota Manager Old" },
      { name: "Assign Employee Shift" },
      { name: "Employee Shift Calendar" },
      { name: "Shift" },
      { name: "Shift Break" },
      { name: "Shift Time Schedule" },
      { name: "Company Location" },
      { name: "Department" },
      { name: "Designation" },
      { name: "Filter Rota By Group" },
      { name: "Filter Rota By Location" },
      { name: "Filter Rota By Shift" },
      { name: "Manage Staff" },
      { name: "Rota Pattern" },
      { name: "Rota Pattern Name" },
      { name: "Rota Settings" },
      { name: "Shift Calendar Name" },
      { name: "Shift Calendar Schedule" }
    ]
  },
  {
    name: "Accountant Dashboard",
    subModules: [
      { name: "Assign Accountant" }
    ]
  },
  {
    name: "Accounting Reports",
    subModules: [
      { name: "Aged Creditors" },
      { name: "Aged Debtors" },
      { name: "Annual Account Head Balance" },
      { name: "Balance Sheet" },
      { name: "Capital Assets" },
      { name: "Customer Sales" },
      { name: "Dividends" },
      { name: "Final Accounts" },
      { name: "Journal Entries" },
      { name: "Profit And Loss" },
      { name: "Trial Balance" }
    ]
  },
  {
    name: "Partners Dashboard",
    subModules: [
      { name: "Assign Partner" },
      { name: "Create Invoices" },
      { name: "Edit Landing Page" },
      { name: "Go to GoCardless" },
      { name: "Go to Webmail" },
      { name: "Member Resources" },
      { name: "Partner Account" },
      { name: "View Calendar" },
      { name: "View Pricelist" }
    ]
  },
  {
    name: "Subscription Manager",
    subModules: [
      { name: "Account Balance" },
      { name: "Deposit Transactions" },
      { name: "Module Group List Rate" },
      { name: "Org Account Rate" },
      { name: "Subscribe Module" },
      { name: "Subscription Charge History" }
    ]
  },
  {
    name: "Device Manager",
    subModules: [
      { name: "Device Manager Details" },
      { name: "Device Name Setting" },
      { name: "Device Process File" },
      { name: "Device Setting" },
      { name: "Device Sheet Import" },
      { name: "Device User" },
      { name: "Sync User To Device" }
    ]
  },
  {
    name: "Checklist Config",
    subModules: [
      { name: "Checklist" },
      { name: "Checklist Employee" },
      { name: "Checklist Items" },
      { name: "Checklist Maintenance Detail" },
      { name: "Checklist Maintenance Master" },
      { name: "Checklist System Link" },
      { name: "Employee Checklist" }
    ]
  },
  {
    name: "Contact Manager",
    subModules: [
      { name: "Contact Details" },
      { name: "Contact Master" },
      { name: "Customer" },
      { name: "Supplier" }
    ]
  },
  {
    name: "Currency Manager",
    subModules: [
      { name: "Currency Master" },
      { name: "Currency Rate" }
    ]
  },
  {
    name: "Hierarchy Manager",
    subModules: [
      { name: "Company Hierarchy" },
      { name: "Geography Hierarchy" },
      { name: "Hierarchy Level" },
      { name: "Hierarchy Level Details" },
      { name: "Hierarchy Type" },
      { name: "Management Hierarchy" },
      { name: "Requirement Hierarchy" }
    ]
  },
  {
    name: "Holiday Manager",
    subModules: [
      { name: "Group By Holiday Group" },
      { name: "Holiday Group Master" },
      { name: "Holiday Master" }
    ]
  },
  {
    name: "Loan Manager",
    subModules: [
      { name: "Loan Employee" },
      { name: "Loan Master" },
      { name: "Loan Repayment" },
      { name: "Loan Repayment Schedule" }
    ]
  },
  {
    name: "Operational Location",
    subModules: [
      { name: "Address" },
      { name: "City Or Town" },
      { name: "Continent" },
      { name: "Country" },
      { name: "County" },
      { name: "District" },
      { name: "Location Type" },
      { name: "Locations" },
      { name: "Postcode Details" },
      { name: "State" },
      { name: "Street Details" },
      { name: "Timezone" }
    ]
  },
  {
    name: "Security Manager",
    subModules: [
      { name: "Active Sessions" },
      { name: "Authority Level" },
      { name: "Login Attempts" },
      { name: "Login Management" },
      { name: "Login Status" },
      { name: "Role Master" },
      { name: "User Domains" },
      { name: "User Group Role" },
      { name: "User Groups" },
      { name: "User Roles" },
      { name: "Users" }
    ]
  },
  {
    name: "Utilities Manager",
    subModules: [
      { name: "Code Generation" },
      { name: "Create Menu" },
      { name: "Delete Brand" },
      { name: "Import / Export Attendance Register" },
      { name: "Import Export" },
      { name: "Period Manager" },
      { name: "Sub Branding" },
      { name: "Sync Brand Setting" },
      { name: "Sync Employee Details" },
      { name: "User Type Role Details" }
    ]
  },
  {
    name: "Advance Settings",
    subModules: [
      { name: "Benefit Rules" },
      { name: "Bills Setting" },
      { name: "Business Trans Category Config" },
      { name: "Business Trans Category Type Config" },
      { name: "Component Member" },
      { name: "Credit Note Setting" },
      { name: "Debit Memo Setting" },
      { name: "Default Accounting Group Rule" },
      { name: "Email Config" },
      { name: "Emp Monthly Salary" },
      { name: "Emp Yearly Salary" },
      { name: "Estimate Setting" },
      { name: "Exit Form Setting" },
      { name: "Experience Letter Setting" },
      { name: "Fees Setting" },
      { name: "Flat Deduction Rules" },
      { name: "Gross Earning Configuration" },
      { name: "Investment Declaration Rules" },
      { name: "Invoice Setting" },
      { name: "Pay Component Config" },
      { name: "Payout Setting" },
      { name: "Proposal Setting" },
      { name: "Purchase Order Setting" },
      { name: "Quotes Setting" },
      { name: "Rebate Rules" },
      { name: "Relieving Order Setting" },
      { name: "Remittance Setting" },
      { name: "Salary Component" },
      { name: "Salary Slip Setting" },
      { name: "Sales Order Setting" },
      { name: "VAT Registration Settings" }
    ]
  },
  {
    name: "Announcement",
    subModules: [
      { name: "Announcement" }
    ]
  },
  {
    name: "Company Hierarchy",
    subModules: []
  },
  {
    name: "Digital Signature",
    subModules: [
      { name: "Experience Letter Template" }
    ]
  },
  {
    name: "Knowledge and Skills",
    subModules: [
      { name: "Employee Info" },
      { name: "KNS Category" },
      { name: "KNS Skills" },
      { name: "My Approved KNS Projects" },
      { name: "My Approved KNS Skills" },
      { name: "My KNS Projects" },
      { name: "My Pending KNS Project Approval" },
      { name: "My Pending KNS Skills Approval" },
      { name: "My Rejected KNS Projects" },
      { name: "My Rejected KNS Skills" },
      { name: "My Team Approved KNS Projects" },
      { name: "My Team Approved KNS Skills" },
      { name: "My Team KNS Projects" },
      { name: "My Team Rejected KNS Projects" },
      { name: "My Team Rejected KNS Skills" },
      { name: "Team Details" },
      { name: "Team Pending KNS Projects Approval" },
      { name: "Team Pending KNS Skills Approval" }
    ]
  },
  {
    name: "Master Data Manager",
    subModules: [
      { name: "Common Type" },
      { name: "Config and Mapping" },
      { name: "Employee Status" },
      { name: "Invoice Setting" },
      { name: "Masters" },
      { name: "System Entities" }
    ]
  },
  {
    name: "Organisation Details",
    subModules: [
      { name: "Company Documents" },
      { name: "Oa Brands" }
    ]
  },
  {
    name: "Period Manager",
    subModules: [
      { name: "Period Master" }
    ]
  },
  {
    name: "Profile and Permissions",
    subModules: [
      { name: "Permission Details" },
      { name: "Profile Class" },
      { name: "Profile Class Roles" },
      { name: "Profile Class User Groups" },
      { name: "Profile Class Users" }
    ]
  },
  {
    name: "System Settings",
    subModules: [
      { name: "System Glossary" },
      { name: "System Last Details" },
      { name: "System Setting" },
      { name: "User Last Login" },
      { name: "test menu 2025" },
      { name: "Test Sub Module 3 Management" }
    ]
  }
];
