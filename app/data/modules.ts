import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Users,
  CalendarCheck,
  CalendarX,
  Clock,
  AlertCircle,
  ShoppingCart,
  BarChart3,
  Settings,
  ShieldCheck,
  FileSearch,
  DollarSign,
  Sliders,
  Wallet,
  HelpCircle,
  Building,
  UserCheck,
  Send,
  ClipboardList,
  Coins,
  MapPin,
  Flame,
  Award
} from 'lucide-react';

export interface ModuleItem {
  name: string;
  icon: any;
  color: string;
  subModules: string[];
}

export const modulesData: ModuleItem[] = [
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-blue-500',
    subModules: ['Employee Dashboard', 'Attendance Dashboard', 'Leave Dashboard', 'Timesheet Dashboard']
  },
  {
    name: 'Sales Order',
    icon: FileText,
    color: 'text-emerald-500',
    subModules: ['Sales Order']
  },
  {
    name: 'Bank Manager',
    icon: Briefcase,
    color: 'text-purple-500',
    subModules: [
      'Bank Account Details',
      'Bank Name Master',
      'Bank Statement Setting',
      'Bank Transaction',
      'Import Freeagent Transactions'
    ]
  },
  {
    name: 'Employee Hub',
    icon: Users,
    color: 'text-sky-500',
    subModules: [
      'Address',
      'Bank Accounts',
      'Confirmation Pending',
      'Dependent',
      'Education',
      'Emergency Contacts',
      'Employee Email',
      'Employee Manager',
      'Employee Phone',
      'Employee Reporting',
      'Employee Termination',
      'Employment Application',
      'Exit and Clearance Formality',
      'Investment Details',
      'Job Detail',
      'Languages Known',
      'Licences',
      'Member Documents',
      'Membership',
      'My Picture',
      'Nationality',
      'Regulatory Requirement',
      'Salary Details',
      'Team Employee Manager',
      'Work Experience',
      'Work Locations',
      'Work Shifts'
    ]
  },
  {
    name: 'Attendance',
    icon: CalendarCheck,
    color: 'text-teal-500',
    subModules: [
      'Adhoc Punch Requests',
      'Attendance Calendar Event List',
      'Attendance Holiday Calendar',
      'Attendance Register',
      'Daily Attendance',
      'Employee Info',
      'Monthly Register',
      'My Attendance Log',
      'My Team Attendance Log',
      'My Team Attendance Register',
      'My Team Monthly Register',
      'Punch In-Out',
      'Punch Monitor',
      'Sync Attendance',
      'Team Details'
    ]
  },
  {
    name: 'Leave',
    icon: CalendarX,
    color: 'text-amber-500',
    subModules: [
      'Employee Info',
      'Employee Leave Entitlement',
      'Employee Leave Summary',
      'Employee Status',
      'Leave Allocation Adhoc',
      'Leave Cancellation',
      'Leave Designation Setting',
      'Leave Encash',
      'Leave Monthly Credit',
      'Leave Period Details',
      'Leave Report',
      'Leave Request',
      'Leave Sanction',
      'Leave Setting',
      'Leave Type Config',
      'My Approved Leave',
      'My Leave Cancellation',
      'My leave Details',
      'My Leave Request',
      'My Pending Leave',
      'My Rejected Leave',
      'My Team Approved Leave',
      'My Team Cancelled Leave',
      'My Team Leave Request',
      'My Team Pending Leave',
      'My Team Rejected Leave',
      'Team Details',
      'Team Leave Request'
    ]
  },
  {
    name: 'Timesheet',
    icon: Clock,
    color: 'text-lime-500',
    subModules: [
      'Approved Timesheets',
      'Configure Projects',
      'Configure Tasks',
      'Delayed Timsheet Allowance',
      'Employee Info',
      'Manage Timesheet',
      'My Timesheet',
      'New Timesheet Item',
      'Pending Approval Timesheets',
      'Rejected Timesheets',
      'Submit for Approval Timesheet',
      'Team Approved Timesheets',
      'Team Details',
      'Team Pending Approval Timesheets',
      'Team Rejected Timesheets',
      'Team Timesheets',
      'Timesheet Audit',
      'Timesheet Item',
      'Timesheet Period Details'
    ]
  },
  {
    name: 'Late Coming',
    icon: AlertCircle,
    color: 'text-rose-500',
    subModules: [
      'Late Coming Daily Summary',
      'Late Coming Monthly Summary',
      'Late Coming Rules',
      'Late Coming Team Daily Summary',
      'Late Coming Team Monthly Summary',
      'Late Coming Team Weekly Summary',
      'Late Coming Weekly Summary'
    ]
  },
  {
    name: 'Purchase Order',
    icon: ShoppingCart,
    color: 'text-orange-500',
    subModules: ['Purchase Order']
  },
  {
    name: 'Accounting Reports',
    icon: BarChart3,
    color: 'text-indigo-500',
    subModules: [
      'Aged Creditors',
      'Aged Debtors',
      'Annual Account Head Balance',
      'Balance Sheet',
      'Capital Assets',
      'Customer Sales',
      'Dividends',
      'Final Accounts',
      'Journal Entries',
      'Profit And Loss',
      'Trial Balance'
    ]
  },
  {
    name: 'Advance Settings',
    icon: Settings,
    color: 'text-slate-500',
    subModules: [
      'Benefit Rules',
      'Bills Setting',
      'Business Trans Category Config',
      'Business Trans Category Type Config',
      'Component Member',
      'Credit Note Setting',
      'Debit Memo Setting',
      'Default Accounting Group Rule',
      'Email Config',
      'Emp Monthly Salary',
      'Emp Yearly Salary',
      'Estimate Setting',
      'Exit Form Setting',
      'Experience Letter Setting',
      'Fees Setting',
      'Flat Deduction Rules',
      'Gross Earning Configuration',
      'Investment Declaration Rules',
      'Invoice Setting',
      'Pay Component Config',
      'Payout Setting',
      'Proposal Setting',
      'Purchase Order Setting',
      'Quotes Setting',
      'Rebate Rules',
      'Relieving Order Setting',
      'Remittance Setting',
      'Salary Component',
      'Salary Slip Setting',
      'Sales Order Setting',
      'VAT Registration Settings'
    ]
  },
  {
    name: 'Security Manager',
    icon: ShieldCheck,
    color: 'text-red-500',
    subModules: [
      'Active Sessions',
      'Authority Level',
      'Login Attempts',
      'Login Management',
      'Login Status',
      'Role Master',
      'User Domains',
      'User Group Role',
      'User Groups',
      'User Roles',
      'Users'
    ]
  },
  {
    name: 'Recruitment',
    icon: FileSearch,
    color: 'text-yellow-600',
    subModules: [
      'Activities',
      'Applicant Details',
      'Calendar',
      'Candidate Education',
      'Candidate History',
      'Candidate Master',
      'Candidate Other Info',
      'Candidate Reference',
      'Candidate Work Experience',
      'Close Vacancy',
      'Interview Master',
      'Interviewer Comments',
      'Job Application Master',
      'Job Appointed Candidate',
      'Job offered to Candidate',
      'Recruitment Attachment',
      'Reports',
      'Vacancy Master'
    ]
  },
  {
    name: 'Payroll',
    icon: DollarSign,
    color: 'text-emerald-600',
    subModules: [
      'Advance Salary',
      'Annexure Processing',
      'Annually Pay Summary',
      'Component Wise Salary Breakup',
      'Daily Pay Summary',
      'Employee Details',
      'Form 16',
      'Incentive',
      'Monthly Gross Report',
      'Monthly Net Report',
      'Monthly Pay Summary',
      'My Annexures',
      'My Payslips',
      'Outdoor Allowance Details',
      'Payroll Attendance Summary',
      'Payroll Processing',
      'Professional Tax',
      'Salary Bank Transfer Report',
      'Salary Breakup',
      'Weekly Pay Summary'
    ]
  },
  {
    name: 'Work Shift And Rota',
    icon: Sliders,
    color: 'text-cyan-500',
    subModules: [
      'Assign Employee Shift',
      'Company Location',
      'Department',
      'Designation',
      'Employee Shift Calendar',
      'Filter Rota By Group',
      'Filter Rota By Location',
      'Filter Rota By Shift',
      'Manage Staff',
      'Rota',
      'Rota Day View',
      'Rota Manager',
      'Rota Manager Old',
      'Rota Pattern',
      'Rota Pattern Name',
      'Rota Settings',
      'Shift',
      'Shift Break',
      'Shift Calendar Name',
      'Shift Calendar Schedule',
      'Shift Time Schedule'
    ]
  },
  {
    name: 'Expenses Manager',
    icon: Wallet,
    color: 'text-rose-500',
    subModules: [
      'Approved Expenses',
      'Expenses',
      'Expenses Drafted',
      'Expenses Employee',
      'Expenses Rejected',
      'Expenses Request For Approval'
    ]
  },
  {
    name: 'Support',
    icon: HelpCircle,
    color: 'text-indigo-500',
    subModules: [
      'Assign Tickets',
      'Closed Tickets',
      'Email Support',
      'Feedback',
      'Link Support To Org',
      'Online Chat Support',
      'Open Tickets',
      'Phone Support',
      'Resolved Tickets',
      'Ticket',
      'Ticket Priority Config',
      'Ticket Statics Topic',
      'Ticket Statistics',
      'Ticket Status Config',
      'Ticket Thread'
    ]
  },
  {
    name: 'Asset Manager',
    icon: Building,
    color: 'text-violet-500',
    subModules: [
      'Asset Attribute',
      'Asset Attribute Master',
      'Asset Depreciation',
      'Asset Employee',
      'Asset Finance',
      'Asset Manager',
      'Asset Master',
      'Asset Register',
      'Asset Services',
      'Issue',
      'Returns'
    ]
  },
  {
    name: 'System Settings',
    icon: Settings,
    color: 'text-slate-500',
    subModules: [
      'System Glossary',
      'System Last Details',
      'System Setting',
      'User Last Login',
      'User Roles',
      'Department Hierarchy',
      'Regional Settings'
    ]
  },
  {
    name: 'Master Data Manager',
    icon: Settings,
    color: 'text-slate-500',
    subModules: [
      'Common Type',
      'Config & Mapping',
      'Employee Status',
      'Invoice Setting',
      'Maters',
      'System Entities'
    ]
  }
];
