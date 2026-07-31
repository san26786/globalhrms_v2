import { DeptEngagement, SalarySlab, JoiningTrend, Employee } from '../types';

export const DEPT_ENGAGEMENT_DATA: DeptEngagement[] = [
  { department: 'Administration', percentage: 36.8, count: 56, color: '#3b82f6' }, // bright blue
  { department: 'Digital Marketing', percentage: 13.2, count: 20, color: '#f97316' }, // orange
  { department: 'Finance', percentage: 8.6, count: 13, color: '#eab308' }, // yellow
  { department: 'Human Resource', percentage: 15.8, count: 24, color: '#10b981' }, // green
  { department: 'Marketing', percentage: 13.2, count: 20, color: '#a855f7' }, // purple
  { department: 'Project Management', percentage: 5.3, count: 8, color: '#1d4ed8' }, // deep blue
  { department: 'Quality Assurance', percentage: 3.3, count: 5, color: '#ec4899' }, // pink
  { department: 'Sales', percentage: 2.6, count: 4, color: '#84cc16' }, // lime green
  { department: 'Training', percentage: 1.2, count: 2, color: '#ef4444' } // red
];

export const SALARY_SLAB_DATA: SalarySlab[] = [
  { range: '10000 - 1000000', count: 285 },
  { range: '100001 - 200000', count: 192 },
  { range: '200001 - 300000', count: 96 },
  { range: '300001 - 400000', count: 58 },
  { range: '400001 - 500000', count: 34 },
  { range: '500001 - 600000', count: 18 },
  { range: '600001 - 700000', count: 7 }
];

export const JOINING_TREND_DATA: JoiningTrend[] = [
  { year: 2016, count: 12 },
  { year: 2017, count: 18 },
  { year: 2018, count: 24 },
  { year: 2019, count: 32 },
  { year: 2020, count: 45 },
  { year: 2021, count: 62 },
  { year: 2022, count: 75 },
  { year: 2023, count: 95 },
  { year: 2024, count: 120 },
  { year: 2025, count: 165 },
  { year: 2026, count: 145 }
];

export const PENDING_OUTDOOR_DATA: Employee[] = [
  {
    id: 'emp-1',
    name: 'Ravi Kumar',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    role: 'Senior Associate',
    outdoorReason: 'Client Meeting',
    date: '10 Jul 2026'
  },
  {
    id: 'emp-2',
    name: 'Neha Sharma',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    role: 'HR Executive',
    outdoorReason: 'Bank Work',
    date: '10 Jul 2026'
  },
  {
    id: 'emp-3',
    name: 'Amit Singh',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    role: 'Tech Lead',
    outdoorReason: 'Official Work',
    date: '09 Jul 2026'
  },
  {
    id: 'emp-4',
    name: 'Priya Verma',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    role: 'Marketing Manager',
    outdoorReason: 'Vendor Meeting',
    date: '09 Jul 2026'
  },
  {
    id: 'emp-5',
    name: 'Sandeep Yadav',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
    role: 'Site Engineer',
    outdoorReason: 'Site Visit',
    date: '09 Jul 2026'
  }
];
