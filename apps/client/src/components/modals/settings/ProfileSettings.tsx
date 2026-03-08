import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, updatePassword } from "@features/auth/auth.ts";

export function ProfileSettings() {
  const { currentUser } = useAuth();
  const [email, setEmail] = useState(currentUser?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || email === currentUser?.email) return;

    setIsUpdatingProfile(true);
    try {
      await updateProfile(email);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const success = await updatePassword(currentPassword, newPassword);
      if (success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="profile-settings">
      <div className="settings-section">
        <h4>Update Profile</h4>
        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label htmlFor="profile-email">Email Address</label>
            <input
              type="email"
              id="profile-email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isUpdatingProfile || email === currentUser?.email}
          >
            {isUpdatingProfile ? "Updating..." : "Update Email"}
          </button>
        </form>
      </div>

      <div className="settings-section" style={{ marginTop: "2rem" }}>
        <h4>Change Password</h4>
        <form onSubmit={handleUpdatePassword}>
          <div className="form-group">
            <label htmlFor="current-password">Current Password</label>
            <input
              type="password"
              id="current-password"
              className="form-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input
              type="password"
              id="new-password"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              type="password"
              id="confirm-password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isUpdatingPassword || !currentPassword || !newPassword}
          >
            {isUpdatingPassword ? "Updating..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
