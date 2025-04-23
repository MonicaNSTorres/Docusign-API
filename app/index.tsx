"use client";

import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [token, setToken] = useState("");
  const router = useRouter();

  const salvarToken = () => {
    localStorage.setItem("docusign_token", token);
    alert("Token salvo com sucesso!");
    router.push("/userinfo");
  };

  return (
    <div className="max-w-xl mx-auto mt-20 p-6 bg-white shadow-lg rounded-xl">
      <h1 className="text-xl font-bold mb-4">Salvar token DocuSign</h1>
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Cole aqui seu access_token JWT"
        className="w-full border p-3 mb-4 rounded"
        rows={5}
      />
      <button
        onClick={salvarToken}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
      >
        Salvar token e ir para /userinfo
      </button>
    </div>
  );
}
