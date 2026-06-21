import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid
} from 'recharts';

export const HeroChartPreview = () => {
  const [activeChart, setActiveChart] = useState(0); // 0 = Line, 1 = Pie

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveChart(prev => (prev === 0 ? 1 : 0));
    }, 5000); // Cycle every 5 seconds
    return () => clearInterval(timer);
  }, []);

  const chartColors = {
    border: "#2A2C2E",
    disabled: "#5C5E60",
    foreground: "#F2F2F2",
    mutedForeground: "#9A9C9E",
    elevated: "#1F2123",
  };

  // Mock Data for Line Chart
  const stockMovementData = [
    { day: "Mon", onHand: 150, reserved: 40 },
    { day: "Tue", onHand: 140, reserved: 50 },
    { day: "Wed", onHand: 180, reserved: 45 },
    { day: "Thu", onHand: 170, reserved: 60 },
    { day: "Fri", onHand: 210, reserved: 55 },
    { day: "Sat", onHand: 200, reserved: 80 },
    { day: "Sun", onHand: 240, reserved: 70 },
  ];

  // Mock Data for Donut Chart
  const totalOrders = 142;
  const donutData = [
    { name: "Completed", value: 65, color: "#10b981" }, // success
    { name: "In Progress", value: 45, color: "#eab308" }, // warning
    { name: "Draft", value: 20, color: chartColors.mutedForeground },
    { name: "Cancelled", value: 12, color: "#ef4444" }, // danger
  ];

  return (
    <div className="relative w-full h-56 flex items-center justify-center">
      
      {/* Chart 1: Line Chart */}
      <div 
        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex flex-col ${
          activeChart === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
        }`}
      >
        <div className="mb-4 text-center">
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest block font-mono">Real-Time Data</span>
          <h3 className="text-lg font-bold text-textPrimary tracking-tight">Stock Movement Ledger</h3>
        </div>
        <div className="flex-1 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stockMovementData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.border} vertical={false} />
              <XAxis dataKey="day" stroke={chartColors.disabled} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={chartColors.disabled} fontSize={10} tickLine={false} axisLine={false} />
              <Line type="monotone" dataKey="onHand" stroke={chartColors.foreground} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="reserved" stroke={chartColors.mutedForeground} strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Donut Chart */}
      <div 
        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex flex-col ${
          activeChart === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
        }`}
      >
        <div className="mb-4 text-center">
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest block font-mono">Real-Time Data</span>
          <h3 className="text-lg font-bold text-textPrimary tracking-tight">Order Status Breakdown</h3>
        </div>
        <div className="flex-1 w-full relative flex items-center justify-center">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  stroke="none"
                >
                  {donutData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold tracking-tight text-textPrimary">{totalOrders}</span>
              <span className="text-[9px] text-textMuted font-medium uppercase tracking-wider">Orders</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
