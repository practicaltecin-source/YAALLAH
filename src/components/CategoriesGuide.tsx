import { Database } from '../types';
import { GraduationCap, CheckCircle2, BookOpen } from 'lucide-react';

interface CategoriesGuideProps {
  db: Database;
  onNavigateToPrograms?: () => void;
}

export default function CategoriesGuide({ db }: CategoriesGuideProps) {
  const categoriesList = [
    {
      id: 'kids',
      name: '🧒 KIDS',
      categoryTag: 'Category 1',
      classes: 'Class 1 & Class 2',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description: 'Primary level competitions designed for young students in Class 1 & Class 2.',
    },
    {
      id: 'sub_junior',
      name: '🎒 SUB JUNIOR',
      categoryTag: 'Category 2',
      classes: 'Class 3 & Class 4',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
      description: 'Lower primary level competitions for students in Class 3 & Class 4.',
    },
    {
      id: 'junior',
      name: '⭐ JUNIOR',
      categoryTag: 'Category 3',
      classes: 'Class 5 & Class 6',
      badgeBg: 'bg-violet-100 text-violet-800 border-violet-300',
      description: 'Upper primary level competitions for students in Class 5 & Class 6.',
    },
    {
      id: 'senior',
      name: '🔥 SENIOR',
      categoryTag: 'Category 4',
      classes: 'Class 7 & Class 8',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      description: 'High school junior tier competitions for students in Class 7 & Class 8.',
    },
    {
      id: 'super_senior',
      name: '🏆 SUPER SENIOR',
      categoryTag: 'Category 5',
      classes: 'Class 9 to Class 12',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      description: 'Senior high school level competitions for students in Class 9, 10, 11 & 12.',
    },
    {
      id: 'general',
      name: '🌐 GENERAL',
      categoryTag: 'Open Category',
      classes: 'Class 5 to Class 12 (Open to Class 5 & Above)',
      badgeBg: 'bg-brand-gold-100 text-brand-gold-900 border-brand-gold-300 font-bold',
      description: 'General competitions open to upper primary and high school students (Class 5 and above).',
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Page Header */}
      <div className="bg-brand-panel border border-brand-line rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-brand-green-900 pointer-events-none">
          <GraduationCap className="w-32 h-32" />
        </div>
        <div className="flex items-center gap-2.5 text-brand-green-900 font-bold text-lg md:text-xl font-display">
          <div className="p-2.5 bg-brand-green-900 text-brand-gold-400 rounded-xl shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="leading-tight">Categories &amp; Class Divisions</h1>
            <p className="text-xs font-sans text-brand-ink-soft font-normal">Official Class Mapping Guide</p>
          </div>
        </div>
        <p className="text-xs text-brand-ink leading-relaxed max-w-xl pt-1">
          Official categorization guide for <strong>{db.settings.eventName}</strong>. Students are mapped to specific categories based on their class divisions.
        </p>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoriesList.map((cat) => (
          <div 
            key={cat.id} 
            className="bg-white border border-brand-line/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-extrabold text-sm md:text-base text-brand-green-950">
                  {cat.name}
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${cat.badgeBg}`}>
                  {cat.categoryTag}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs bg-brand-bg/70 p-2.5 rounded-xl border border-brand-line/50 font-medium text-brand-ink">
                <BookOpen className="w-4 h-4 text-brand-green-800 shrink-0" />
                <span>{cat.classes}</span>
              </div>

              <p className="text-xs text-brand-ink-soft leading-relaxed pt-0.5">
                {cat.description}
              </p>
            </div>

            {/* Info footer */}
            <div className="pt-2 border-t border-brand-line/40 flex items-center justify-between text-[11px] text-brand-ink-soft">
              <span className="flex items-center gap-1 font-semibold text-brand-green-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Standard Division
              </span>
              <span className="font-mono text-[10px] text-brand-ink-soft">
                {db.settings.eventName}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
