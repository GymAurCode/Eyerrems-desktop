import { useState, useEffect } from "react";
import ModuleDialog from "../../ui/ModuleDialog";
import { propApi } from "../../../lib/propertyApi";

interface AddRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: number;
  currentRole?: string;
  initialRole?: string;
  onSaved?: () => void;
}

export default function AddRoleDialog({ isOpen, onClose, contactId, currentRole, initialRole, onSaved }: AddRoleDialogProps) {
  const [value, setValue] = useState("buyer");

  useEffect(() => {
    if (isOpen) {
      setValue(initialRole ?? (currentRole?.includes("seller") ? "buyer" : "seller"));
    }
  }, [isOpen, currentRole, initialRole]);

  const submit = async () => {
    await propApi.addContactRole(contactId, value);
    onSaved();
    onClose();
  };

  return (
    <ModuleDialog isOpen={isOpen} onClose={onClose} title="Add Role" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Role to Add</label>
          <select className="select-dark w-full px-3 py-2.5 text-sm" value={value}
            onChange={(e) => setValue(e.target.value)}>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="agent">Agent</option>
          </select>
        </div>
        <button className="btn-property w-full py-3 text-sm" type="button" onClick={() => void submit()}>
          Add Role
        </button>
      </div>
    </ModuleDialog>
  );
}
