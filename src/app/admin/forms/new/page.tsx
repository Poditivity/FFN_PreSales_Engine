import { FormBuilder } from "../FormBuilder";

export default function NewFormPage() {
  return (
    <div>
      <h1 className="h1">New form</h1>
      <div style={{ marginTop: "var(--space-6)" }}>
        <FormBuilder />
      </div>
    </div>
  );
}
