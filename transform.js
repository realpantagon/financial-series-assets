import fs from 'fs';
import path from 'path';

const filePath = 'e:/MyProject/financial-series-assets/src/pages/FCDDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  [/bg-gray-50/g, 'bg-background text-foreground'],
  [/bg-white/g, 'bg-[oklch(0.09_0.012_255/0.4)] backdrop-blur-md'],
  [/border-gray-200/g, 'border-border/20'],
  [/border-gray-300/g, 'border-border/20'],
  [/border-slate-100/g, 'border-border/20'],
  [/border-slate-200/g, 'border-border/20'],
  [/border-slate-50/g, 'border-border/10'],
  [/text-slate-900/g, 'text-foreground'],
  [/text-slate-700/g, 'text-foreground/90'],
  [/text-slate-600/g, 'text-muted-foreground'],
  [/text-slate-500/g, 'text-muted-foreground'],
  [/text-slate-400/g, 'text-muted-foreground/60'],
  [/text-sky-600/g, 'text-cyan-400'],
  [/text-sky-500/g, 'text-cyan-400'],
  [/bg-sky-500/g, 'bg-cyan-500 text-black font-bold'],
  [/bg-sky-600/g, 'bg-cyan-400'],
  [/bg-sky-100/g, 'bg-cyan-500/20'],
  [/bg-sky-50/g, 'bg-cyan-500/10'],
  [/hover:bg-sky-600/g, 'hover:bg-cyan-400'],
  [/hover:bg-slate-50/g, 'hover:bg-white/5'],
  [/bg-slate-900/g, 'bg-cyan-500 text-black'],
  [/hover:bg-slate-800/g, 'hover:bg-cyan-400 text-black'],
  [/bg-slate-50/g, 'bg-white/5'],
  [/border-sky-200/g, 'border-cyan-500/30'],
  [/ring-sky-500\/20/g, 'ring-cyan-500/30'],
  [/ring-sky-500/g, 'ring-cyan-500'],
  [/focus:border-sky-500/g, 'focus:border-cyan-500'],
  [/hover:border-sky-100/g, 'hover:border-cyan-500/30'],
  [/text-emerald-600/g, 'text-emerald-400'],
  [/text-emerald-500/g, 'text-emerald-400'],
  [/bg-emerald-50/g, 'bg-emerald-500/15 border border-emerald-500/20'],
  [/text-rose-600/g, 'text-rose-400'],
  [/text-rose-500/g, 'text-rose-400'],
  [/bg-rose-50/g, 'bg-rose-500/15 border border-rose-500/20'],
  [/shadow-sm/g, 'shadow-none'],
  [/shadow-md/g, 'shadow-none'],
  [/shadow-lg/g, 'shadow-none'],
  [/shadow-2xl/g, 'shadow-none'],
  [/shadow-slate-200/g, 'shadow-none'],
  [/"#f1f5f9"/g, '"#3f3f46"'], // CartesianGrid stroke
  [/"#94a3b8"/g, '"#52525b"'], // XAxis stroke
  [/"#64748b"/g, '"#a1a1aa"'], // XAxis fill
  [/"#0ea5e9"/g, '"#22d3ee"'], // Line stroke
  [/"#38bdf8"/g, '"#67e8f9"'], // Line activeDot
  [/>FCD Tracker</g, 'className="font-mono tracking-tight" >FCD Tracker<'],
  [/font-sans/g, 'font-mono'],
  [/font-semibold/g, 'font-bold'],
  [/rounded-2xl/g, 'rounded-xl'],
  [/min-h-screen/g, 'min-h-[calc(100vh-80px)]'], // Prevent scroll over bottom nav
];

replacements.forEach(([regex, replacement]) => {
  content = content.replace(regex, replacement);
});

content = content.replace(/<div className="min-h-\[calc\(100vh-80px\)\] bg-background text-foreground pb-8">/, '<div className="min-h-[calc(100vh-80px)] bg-background text-foreground pb-8 font-mono">');

fs.writeFileSync(filePath, content);
console.log('Successfully transformed FCDDashboard.tsx to Dark Mode matching PanAssets.');
