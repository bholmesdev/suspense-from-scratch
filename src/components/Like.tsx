import { useState } from "react";

export default function Like() {
  const [likes, setLikes] = useState(0);
  return (
    <button type="button" onClick={() => setLikes(likes + 1)}>
      ♥ {likes}
    </button>
  );
}
