import { useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const RichTextEditor = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (content: string) => void;
}) => {
  const [editorValue, setEditorValue] = useState(value || "");
  const quillRef = useRef(false);

  useEffect(() => {
    if (!quillRef.current) {
      quillRef.current = true;
    }

    setTimeout(() => {
      document.querySelectorAll(".ql-toolbar").forEach((toolbar, index) => {
        if (index > 0) {
          toolbar.remove();
        }
      });
    }, 100);
  }, []);

  return (
    <div style={{ maxWidth: "100%", width: "100%" }}>
      <ReactQuill
        theme={"snow"}
        value={editorValue}
        onChange={(content: string) => {
          setEditorValue(content);
          onChange(content);
        }}
        modules={{
          toolbar: [
            [{ font: [] }], // Font picker
            [{ header: [1, 2, 3, 4, 5, 6, false] }], // Headers
            [{ size: ["small", false, "large", "huge"] }], // Font sizes
            ["bold", "italic", "underline", "strike"], // Basic text styling
            [{ color: [] }, { background: [] }], // Font & Background colors
            [{ script: "sub" }, { script: "super" }], // Subscript / Superscript
            [{ list: "ordered" }, { list: "bullet" }], // Lists
            [{ indent: "-1" }, { indent: "+1" }], // Indentation
            [{ align: [] }], // Text alignment
            ["blockquote", "code-block"], // Blockquote & Code Block
            ["link", "image", "video"], // Insert Link, Image, Video
            ["clean"], // Remove  formatting
          ],
        }}
        placeholder="Write a detailed product description here ..."
        className="bg-transparent border border-gray-700 text-white rounded-md"
      />

      <style>
        {`
        .ql-toolbar {
          background: transparent;
          border-color: #444;
        }

        .ql-container {
          background: transparent !important;
          border-color: #444;
          color: white; /* Text color inside editor */
          max-width: 100%;
        }

        .ql-picker {
          color: white !important;
        }
        .ql-editor {
          min-height: 200px; 
          max-width: 100%;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .ql-snow {
          border-color: #444 !important;
        }

        .ql-editor.ql-blank::before {
          color: #aaa !important; 
        }

        .ql-picker-options {
          background: #333 !important; 
          color: white !important;
        }
          .ql-picker-item {
          color: white !important;
        }

        .ql-stroke {
          stroke: white !important;
        }

        /* Standardize icon sizes */
        .ql-snow .ql-toolbar button svg,
        .ql-snow .ql-toolbar .ql-picker-label svg {
          width: 18px !important;
          height: 18px !important;
          display: block;
        }

        .ql-snow .ql-toolbar button,
        .ql-snow .ql-toolbar .ql-picker {
          width: 28px !important;
          height: 28px !important;
          padding: 3px !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        `}
      </style>
    </div>
  );
};

export default RichTextEditor;
