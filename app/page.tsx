"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

export default function DocuSignDashboard() {
  const [view, setView] = useState<"user" | "envelopes" | "zip" | "database">("user");
  const [userInfo, setUserInfo] = useState<any>(null);
  const [envelopes, setEnvelopes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  const totalPaginas = useMemo(() => Math.ceil(envelopes.length / itensPorPagina), [envelopes.length]);

  const envelopesPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = paginaAtual * itensPorPagina;
    return envelopes.slice(inicio, fim);
  }, [envelopes, paginaAtual]);

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
          const fDate = fromDate || "2020-01-01";
          const tDate = toDate || new Date().toISOString().split("T")[0];

          console.log("📅 Enviando filtros para /api/envelopes:", { fDate, tDate });

          const res = await axios.get(`/api/envelopes?from_date=${fDate}&to_date=${tDate}&status=any`);
          setEnvelopes(res.data.envelopes || []);
          setPaginaAtual(1); // Reinicia para a primeira página
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
      try {
        const res = await axios.get(`/api/download-zip?from_date=${fromDate}&to_date=${toDate}`, {
          responseType: "blob"
        });        

        if (res.headers['content-type'] !== "application/zip") {
          const text = await res.data.text();
          const error = JSON.parse(text);
          console.error("Erro no ZIP (backend):", error);
          alert(error.message || "Erro ao gerar o ZIP.");
          return;
        }

        const blob = new Blob([res.data], { type: "application/zip" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `envelopes_${fromDate}_a_${toDate}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err: any) {
        console.error("Erro ao baixar o ZIP:", err);
        console.error("Erro interno no download ZIP:", err?.response?.data || null);
        alert("Erro ao baixar os arquivos.");
      }
    } catch (err) {
      console.error("Erro ao baixar o ZIP:", err);
      alert("Erro ao baixar os arquivos.");
    }
  };

  const [dbResults, setDbResults] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [responsavelFilter, setResponsavelFilter] = useState("");
  console.log("Enviando filtros para /api/envelopes:", { fromDate, toDate });

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white shadow-md rounded-xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Dashboard DocuSign</h1>

      <div className="mb-6">
        <label className="block mb-2 font-semibold">Escolha o que deseja visualizar:</label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as "user" | "envelopes" | "zip" | "database")}
          className="border border-gray-300 rounded px-4 py-2 w-full"
        >
          <option value="user">Informações do Usuário</option>
          <option value="envelopes">Envelopes Finalizados</option>
          <option value="zip">Baixar Todos (ZIP)</option>
          <option value="database">Consulta no Banco</option>
        </select>
      </div>

      {error && <p className="text-red-500">Erro: {error}</p>}

      <span className="font-semibold text-lg mb-5">{`Total de registros: ${envelopes.length}`}</span>

      {view === "envelopes" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
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
            <div className="flex items-end">
              <button
                onClick={async () => {
                  try {
                    setError(null);
                    const tokenRes = await axios.get("/api/token");
                    const token = tokenRes.data.access_token;

                    const res = await axios.get(
                      `/api/envelopes?from_date=${fromDate}&to_date=${toDate}&status=any`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          Accept: "application/json",
                        },
                      }
                    );
                    setEnvelopes(res.data.envelopes || []);
                    setPaginaAtual(1);
                  } catch (err: any) {
                    console.error("Erro ao buscar envelopes:", err);
                    setError("Erro ao buscar envelopes.");
                  }
                }}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-800 cursor-pointer"
              >
                Buscar
              </button>
            </div>
          </div>

          {envelopes.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                  className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
                  disabled={paginaAtual === 1}
                >
                  Anterior
                </button>
                <span>Página {paginaAtual}</span>
                <button
                  onClick={() => setPaginaAtual((prev) =>
                    prev * itensPorPagina < envelopes.length ? prev + 1 : prev
                  )}
                  className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
                  disabled={paginaAtual * itensPorPagina >= envelopes.length}
                >
                  Próxima
                </button>
              </div>

              <table className="table-auto w-full border border-gray-300 mt-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-4 py-2 text-left">Data</th>
                    <th className="border px-4 py-2 text-left">Assunto</th>
                    <th className="border px-4 py-2 text-left">Status</th>
                    <th className="border px-4 py-2 text-left">PDF</th>
                    <th className="border px-4 py-2 text-left">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {envelopesPaginados.map((env) => (
                    <tr key={env.envelopeId}>
                      <td className="border px-4 py-2">
                        {env.createdDateTime
                          ? new Date(env.createdDateTime).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="border px-4 py-2">{env.emailSubject || "Sem assunto"}</td>
                      <td className="border px-4 py-2 capitalize">{env.status}</td>
                      <td className="border px-4 py-2 flex">
                        <a
                          href={`/api/download-pdf?envelopeId=${env.envelopeId}`}
                          target="_blank"
                          className="text-blue-600 hover:underline mr-2"
                        >
                          Baixar PDF
                        </a>
                        <a
                          href={`https://app.docusign.com/documents/details/${env.envelopeId}`}
                          target="_blank"
                          className="text-green-400 hover:underline"
                        >
                          Abrir relatório
                        </a>
                      </td>
                      <td className="border px-4 py-2 capitalize">{env.sender?.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
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
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-800 cursor-pointer"
          >
            Baixar todos os PDFs como ZIP
          </button>
        </div>
      )}
      {view === "database" && (
        <div className="border border-gray-200 p-6 rounded bg-gray-50">
          <h2 className="text-lg font-semibold mb-4">Consulta de Envelopes no Banco</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
            <div>
              <label className="block mb-1">Status:</label>
              <input
                type="text"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded px-4 py-2 w-full"
                placeholder="Ex: completed"
              />
            </div>
            <div>
              <label className="block mb-1">Responsável:</label>
              <input
                type="text"
                value={responsavelFilter}
                onChange={(e) => setResponsavelFilter(e.target.value)}
                className="border rounded px-4 py-2 w-full"
                placeholder="Ex: Lucas"
              />
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const res = await axios.get(`/api/database-envelopes`, {
                  params: {
                    from_date: fromDate,
                    to_date: toDate,
                    status: statusFilter,
                    responsavel: responsavelFilter,
                  },
                });
                console.log("📦 Resultados do banco:", res.data);
                setDbResults(res.data);
              } catch (err) {
                console.error("Erro ao consultar o banco:", err);
                alert("Erro ao buscar envelopes do banco.");
              }
            }}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-800 cursor-pointer"
          >
            Buscar
          </button>

          {dbResults.length > 0 && (
            <table className="table-auto w-full border border-gray-300 mt-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-4 py-2 text-left">Assunto</th>
                  <th className="border px-4 py-2 text-left">Status</th>
                  <th className="border px-4 py-2 text-left">Responsável</th>
                  <th className="border px-4 py-2 text-left">PDF</th>
                </tr>
              </thead>
              <tbody>
                {dbResults.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="border px-4 py-2">{item.EMAIL_SUBJECT}</td>
                    <td className="border px-4 py-2">{item.STATUS}</td>
                    <td className="border px-4 py-2">{item.RESPONSAVEL_NOME}</td>
                    <td className="border px-4 py-2 space-x-2">
                      <a
                        href={`/api/download-from-db?envelopeId=${item.ENVELOPE_ID}`}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        Baixar PDF
                      </a>
                      <a
                        href={`/api/download-from-db?envelopeId=${item.ENVELOPE_ID}&inline=true`}
                        target="_blank"
                        className="text-green-600 hover:underline"
                      >
                        Visualizar
                      </a>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}