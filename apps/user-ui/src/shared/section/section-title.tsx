import TitleBorder from "../../assets/svgs/title-border";
import { Sparkles } from "lucide-react";

type SectionTitleProps = {
  title: string;
  eyebrow?: string;
  suffix?: string;
  description?: string;
};

const SectionTitle = ({
  title,
  eyebrow,
  suffix,
  description,
}: SectionTitleProps) => {
  if (eyebrow || suffix || description) {
    return (
      <div>
        {eyebrow && (
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Sparkles size={14} />
            {eyebrow}
          </span>
        )}
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
            {title}
          </h2>
          {suffix && (
            <span className="border-l border-slate-300 pl-3 text-lg text-slate-400 md:text-xl">
              {suffix}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-slate-500 md:text-base">
            {description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <h1 className="md:text-3xl text-xl relative z-10 font-semibold">
        {title}
      </h1>
      <TitleBorder className="absolute top-[46%]" />
    </div>
  );
};

export default SectionTitle;
