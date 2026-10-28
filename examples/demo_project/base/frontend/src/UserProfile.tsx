import React, { useEffect, useState } from "react";

interface UserResponse {
  user_id: number;
  name: string;
}

export const UserProfile: React.FC<{ targetId: number }> = ({ targetId }) => {
  const [user, setUser] = useState<UserResponse | null>(null);

  useEffect(() => {
    fetch(`/api/users/${targetId}`)
      .then((res) => res.json())
      .then((data: UserResponse) => {
        setUser(data);
      });
  }, [targetId]);

  if (!user) return <div>Loading...</div>;

  const userId = user.user_id;

  return (
    <div className="user-card">
      <h2>{user.name}</h2>
      <p>User ID: {userId}</p>
    </div>
  );
};
