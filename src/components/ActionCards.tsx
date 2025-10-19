import ActionCard from './ActionCard';
import { FileText, BookOpen, ClipboardList, CheckSquare, BrainCircuit, Award, Brain, ChevronDown, ChevronUp, Puzzle } from 'lucide-react';
import { useState } from 'react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ActionCards = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-4xl">
        <ActionCard
          icon={<Puzzle className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />}
          title="Generate an exercise"
          description="Create classroom exercises tailored to your topic and grade level"
          color="cyan"
          delay={0.1}
        />
        <ActionCard
          icon={<BrainCircuit className="w-5 h-5 text-rose-500 dark:text-rose-400" />}
          title="Create a quiz"
          description="Generate comprehensive assessments with varied question types and automatic grading options"
          color="rose"
          delay={0.2}
        />
        <ActionCard
          icon={<BookOpen className="w-5 h-5 text-amber-500 dark:text-amber-400" />}
          title="Create a lesson plan"
          description="Design comprehensive lesson plans with learning objectives, activities, and assessment strategies"
          color="amber"
          delay={0.3}
        />
        <ActionCard
          icon={<ClipboardList className="w-5 h-5 text-blue-500 dark:text-blue-400" />}
          title="Generate an assignment"
          description="Develop structured assignments with clear learning objectives, instructions, and evaluation criteria"
          color="blue"
          delay={0.4}
        />
        
        <AnimatePresence>
          {isExpanded && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <ActionCard
                  icon={<CheckSquare className="w-5 h-5 text-green-500 dark:text-green-400" />}
                  title="Grade a paper"
                  description="Evaluate student work with constructive feedback and targeted improvement recommendations"
                  color="green"
                  delay={0}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.2 }}
              >
                <ActionCard
                  icon={<FileText className="w-5 h-5 text-purple-500 dark:text-purple-400" />}
                  title="Generate a progress report"
                  description="Create detailed student performance reports with metrics, achievements, and areas for development"
                  color="purple"
                  delay={0}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.3 }}
              >
                <ActionCard
                  icon={<Brain className="w-5 h-5 text-teal-500 dark:text-teal-400" />}
                  title="Simplify concept"
                  description="Break down complex topics into clear, digestible explanations with examples and analogies"
                  color="teal"
                  delay={0}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.4 }}
              >
                <ActionCard
                  icon={<Award className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />}
                  title="Provide feedback"
                  description="Create detailed student evaluations with personalized comments and growth suggestions"
                  color="indigo"
                  delay={0}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex justify-center mt-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "p-2 rounded-full",
            "bg-white/80 dark:bg-gray-900/80",
            "border border-gray-200/80 dark:border-gray-800/50",
            "shadow-sm hover:bg-white dark:hover:bg-gray-800",
            "transition-colors duration-200",
            "transform transition-transform hover:scale-110"
          )}
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ActionCards;
