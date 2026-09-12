"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import {
  Image as ImageIcon,
  Layers,
  PencilRuler,
  Plus,
  Save,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import Breadcrumbs from "../../shared/component/breadcrumbs";

type SiteConfig = {
  id: string;
  categories: string[];
  subCategories: Record<string, string[]>;
  logo: string | null;
  banner: string | null;
};

const fetchConfig = async (): Promise<SiteConfig> => {
  const res = await axiosInstance.get("/admin/get-site-config");
  return res.data.config;
};

const patchConfig = async (data: Partial<Omit<SiteConfig, "id">>) => {
  const res = await axiosInstance.patch("/admin/update-site-config", data);
  return res.data.config as SiteConfig;
};

const TABS = [
  { id: "categories", label: "Categories", icon: Layers },
  { id: "logo", label: "Logo", icon: ImageIcon },
  { id: "banner", label: "Banner", icon: Tag },
] as const;
type TabId = (typeof TABS)[number]["id"];

const CustomizationPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("categories");

  const { data: config, isLoading } = useQuery<SiteConfig>({
    queryKey: ["site-config"],
    queryFn: fetchConfig,
    staleTime: 1000 * 60 * 5,
  });

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: patchConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(["site-config"], updated);
    },
  });

  return (
    <div className="w-full min-h-screen p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600/15 text-blue-400">
          <PencilRuler size={18} />
        </div>
        <h2 className="text-2xl text-white font-semibold">Customization</h2>
      </div>

      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          {
            label: "Customization",
            href: "/dashboard/customization",
            active: true,
          },
        ]}
      />

      <div className="flex gap-1 border-b border-slate-800 mb-8">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !config ? (
        <p className="text-slate-400 text-sm">
          Failed to load site configuration.
        </p>
      ) : (
        <>
          {activeTab === "categories" && (
            <CategoriesTab config={config} isSaving={isSaving} onSave={save} />
          )}
          {activeTab === "logo" && (
            <ImageTab
              label="Logo"
              fieldKey="logo"
              hint="Recommended: transparent PNG, min 200x60 px"
              currentUrl={config.logo}
              isSaving={isSaving}
              onSave={save}
            />
          )}
          {activeTab === "banner" && (
            <ImageTab
              label="Banner"
              fieldKey="banner"
              hint="Recommended: 1440x480 px, JPG or PNG"
              currentUrl={config.banner}
              isSaving={isSaving}
              onSave={save}
            />
          )}
        </>
      )}
    </div>
  );
};

type SaveFn = (data: Partial<Omit<SiteConfig, "id">>) => void;

const CategoriesTab = ({
  config,
  isSaving,
  onSave,
}: {
  config: SiteConfig;
  isSaving: boolean;
  onSave: SaveFn;
}) => {
  const [categories, setCategories] = useState<string[]>(
    config.categories ?? [],
  );
  const [subCategories, setSubCategories] = useState<Record<string, string[]>>(
    (config.subCategories as Record<string, string[]>) ?? {},
  );
  const [newCategory, setNewCategory] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [newSub, setNewSub] = useState("");

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories([...categories, trimmed]);
    setNewCategory("");
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
    const subs = { ...subCategories };
    delete subs[cat];
    setSubCategories(subs);
  };

  const addSubcategory = () => {
    const trimmed = newSub.trim();
    if (!trimmed || !selectedCat) return;
    const existing = subCategories[selectedCat] ?? [];
    if (existing.includes(trimmed)) return;
    setSubCategories({
      ...subCategories,
      [selectedCat]: [...existing, trimmed],
    });
    setNewSub("");
  };

  const removeSub = (cat: string, sub: string) => {
    setSubCategories({
      ...subCategories,
      [cat]: subCategories[cat].filter((s) => s !== sub),
    });
  };

  return (
    <div className="max-w-3xl space-y-8">
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Layers size={16} className="text-blue-400" />
          Categories
        </h3>
        <div className="space-y-1 mb-5 max-h-56 overflow-y-auto pr-1">
          {categories.length === 0 && (
            <p className="text-slate-500 text-sm italic">No categories yet.</p>
          )}
          {categories.map((cat) => (
            <div
              key={cat}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/60 group"
            >
              <span className="text-sm text-white">{cat}</span>
              <button
                onClick={() => removeCategory(cat)}
                className="text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="New category name..."
            className="flex-1 bg-gray-800 border border-gray-700 focus:border-blue-500 text-white text-sm rounded-lg px-3 py-2 outline-none transition"
          />
          <button
            onClick={addCategory}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={15} />
            Add Category
          </button>
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Tag size={16} className="text-purple-400" />
          Subcategories
        </h3>
        <div className="space-y-4 mb-5 max-h-64 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const subs = subCategories[cat] ?? [];
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  {cat}
                </p>
                {subs.length === 0 ? (
                  <p className="text-slate-600 text-xs italic pl-1">
                    No subcategories
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {subs.map((sub) => (
                      <span
                        key={sub}
                        className="flex items-center gap-1.5 bg-gray-800 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-gray-700"
                      >
                        {sub}
                        <button
                          onClick={() => removeSub(cat, sub)}
                          className="text-slate-500 hover:text-red-400 transition"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-slate-500 text-sm italic">
              Add a category first.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="bg-gray-800 border border-gray-700 focus:border-blue-500 text-white text-sm rounded-lg px-3 py-2 outline-none transition cursor-pointer min-w-[150px]"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubcategory()}
            placeholder="New subcategory..."
            className="flex-1 bg-gray-800 border border-gray-700 focus:border-blue-500 text-white text-sm rounded-lg px-3 py-2 outline-none transition"
          />
          <button
            onClick={addSubcategory}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus size={15} />
            Add Subcategory
          </button>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => onSave({ categories, subCategories })}
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

const ImageTab = ({
  label,
  fieldKey,
  hint,
  currentUrl,
  isSaving,
  onSave,
}: {
  label: string;
  fieldKey: "logo" | "banner";
  hint: string;
  currentUrl: string | null;
  isSaving: boolean;
  onSave: SaveFn;
}) => {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      setUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) handleFileChange(file);
  };

  const clearImage = () => {
    setPreview(null);
    setUrl("");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-1">{label}</h3>
        <p className="text-slate-300 text-xs mb-5">{hint}</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all h-52 ${
            dragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-600 hover:border-gray-400 bg-gray-800/40"
          }`}
        >
          {preview ? (
            <>
              <img
                src={preview}
                alt={label}
                className="max-h-full max-w-full rounded-lg object-contain p-2"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearImage();
                }}
                className="absolute top-2 right-2 bg-gray-900 border border-gray-700 text-slate-300 hover:text-red-400 p-1 rounded-full transition"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white">
                <Upload size={22} />
              </div>
              <p className="text-sm text-white">
                Drag and drop or{" "}
                <span className="text-blue-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-400">
                PNG, JPG, WebP - max 5 MB
              </p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <div className="mt-4">
          <label className="block text-xs text-slate-300 mb-1.5">
            Or paste an image URL
          </label>
          <input
            type="url"
            value={url.startsWith("data:") ? "" : url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(e.target.value || null);
            }}
            placeholder="https://example.com/image.png"
            className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 text-white text-sm rounded-lg px-3 py-2 outline-none transition"
          />
        </div>
      </section>
      <div className="flex justify-end">
        <button
          onClick={() => onSave({ [fieldKey]: url })}
          disabled={isSaving}
          className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
        >
          {isSaving ? (
            "Saving..."
          ) : (
            <span className="flex items-center gap-1.5">
              <Save size={15} /> Save {label}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-4 max-w-3xl animate-pulse">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="h-14 bg-gray-800/60 rounded-xl" />
    ))}
  </div>
);

export default CustomizationPage;
