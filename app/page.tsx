"use client";

import { useEffect, useState } from "react";
import axios from "axios";

export default function DocuSignDashboard() {
  const [view, setView] = useState<"user" | "envelopes" | "zip">("user");
  const [userInfo, setUserInfo] = useState<any>(null);
  const [envelopes, setEnvelopes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    async function carregarDados() {
      setError(null);
      try {
        const tokenRes = await axios.get("/api/token");
        const token = tokenRes.data.access_token;

        if (view === "user") {
          const res = await axios.get("/api/userinfo", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUserInfo(res.data);
        }

        if (view === "envelopes") {
          const res = await axios.get("/api/envelopes");
          setEnvelopes(res.data.envelopes || []);
        }
      } catch (err: any) {
        console.error("Erro:", err);
        setError(err.response?.data?.error || "Erro desconhecido");
      }
    }

    if (view !== "zip") carregarDados();
  }, [view]);

  const handleDownloadZip = async () => {
    if (!fromDate || !toDate) {
      alert("Preencha as duas datas para baixar o ZIP.");
      return;
    }
  
    try {
      const res = await axios.get(
        `/pages/api/download-zip/route.ts?from_date=${fromDate}&to_date=${toDate}`,
        { responseType: "blob" }
      );                
  
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `envelopes_${fromDate}_a_${toDate}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Erro ao baixar o ZIP:", err);
      alert("Erro ao baixar os arquivos.");
    }
  };
  

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white shadow-md rounded-xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Dashboard DocuSign</h1>

      <div className="mb-6">
        <label className="block mb-2 font-semibold">Escolha o que deseja visualizar:</label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as "user" | "envelopes" | "zip")}
          className="border border-gray-300 rounded px-4 py-2 w-full"
        >
          <option value="user">Informações do Usuário</option>
          <option value="envelopes">Envelopes Finalizados</option>
          <option value="zip">Baixar Todos (ZIP)</option>
        </select>
      </div>

      {error && <p className="text-red-500">Erro: {error}</p>}

      {view === "user" && userInfo && (
        <table className="table-auto w-full border border-gray-300">
          <tbody>
            <tr><td className="border px-4 py-2 font-semibold">Nome</td><td className="border px-4 py-2">{userInfo.name}</td></tr>
            <tr><td className="border px-4 py-2 font-semibold">E-mail</td><td className="border px-4 py-2">{userInfo.email}</td></tr>
            <tr><td className="border px-4 py-2 font-semibold">User ID</td><td className="border px-4 py-2">{userInfo.sub}</td></tr>
            <tr><td className="border px-4 py-2 font-semibold">Data de Criação</td><td className="border px-4 py-2">{userInfo.created}</td></tr>
            {userInfo.accounts?.map((acc: any, i: number) => (
              <tr key={i}>
                <td className="border px-4 py-2 font-semibold">Conta</td>
                <td className="border px-4 py-2">
                  <div>Nome: {acc.account_name}</div>
                  <div>ID: {acc.account_id}</div>
                  <div>Base URI: {acc.base_uri}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === "envelopes" && envelopes.length > 0 && (
        <table className="table-auto w-full border border-gray-300 mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2 text-left">Assunto</th>
              <th className="border px-4 py-2 text-left">Status</th>
              <th className="border px-4 py-2 text-left">PDF</th>
            </tr>
          </thead>
          <tbody>
            {envelopes.map((env) => (
              <tr key={env.envelopeId}>
                <td className="border px-4 py-2">{env.emailSubject || "Sem assunto"}</td>
                <td className="border px-4 py-2 capitalize">{env.status}</td>
                <td className="border px-4 py-2">
                  <a
                    href={`/pages/api/download-pdf.ts?envelopeId=${env.envelopeId}`}
                    target="_blank"
                    className="text-blue-600 hover:underline"
                  >
                    Baixar PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === "zip" && (
        <div className="border border-gray-200 p-6 rounded bg-gray-50">
          <h2 className="text-lg font-semibold mb-4">Download em ZIP com filtro de datas</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1">Data Inicial:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded px-4 py-2 w-full"
              />
            </div>
            <div>
              <label className="block mb-1">Data Final:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded px-4 py-2 w-full"
              />
            </div>
          </div>

          <button
            onClick={handleDownloadZip}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Baixar todos os PDFs como ZIP
          </button>
        </div>
      )}
    </div>
  );
}