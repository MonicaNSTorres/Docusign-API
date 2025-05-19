"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Download, ExternalLink, ArrowDownAZ, ArrowUpZA } from "lucide-react";


export default function DocuSignDashboard() {
  const [view, setView] = useState<"user" | "envelopes" | "zip" | "database">("database");
  const [userInfo, setUserInfo] = useState<any>(null);
  const [envelopes, setEnvelopes] = useState<any[]>([]);
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [ordenacaoDataAsc, setOrdenacaoDataAsc] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [responsavelFilter, setResponsavelFilter] = useState("");

  const [progress, setProgress] = useState<number | null>(null);
  const [totalLotes, setTotalLotes] = useState<number>(0);
  const [dbProgress, setDbProgress] = useState<number | null>(null);

  const [envProgress, setenvProgress] = useState<number | null>(null);

  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  //ordena os envelopes pela data antes de paginar
  const envelopesOrdenados = useMemo(() => {
    return [...envelopes].sort((a, b) => {
      const dateA = new Date(a.createdDateTime).getTime();
      const dateB = new Date(b.createdDateTime).getTime();
      return ordenacaoDataAsc ? dateA - dateB : dateB - dateA;
    });
  }, [envelopes, ordenacaoDataAsc]);


  const totalPaginas = useMemo(() => Math.ceil(envelopes.length / itensPorPagina), [envelopes.length]);

  //aplica paginacao sobre os envelopes ja ordenados
  const envelopesPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = paginaAtual * itensPorPagina;
    return envelopesOrdenados.slice(inicio, fim);
  }, [envelopesOrdenados, paginaAtual]);


  const dbResultsPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = paginaAtual * itensPorPagina;
    return dbResults.slice(inicio, fim);
  }, [dbResults, paginaAtual]);


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

          console.log("Enviando filtros para /api/envelopes:", { fDate, tDate });

          const res = await axios.get(`/api/envelopes?from_date=${fDate}&to_date=${tDate}&status=any`);
          setEnvelopes(res.data.envelopes || []);
          setPaginaAtual(1);
        }
      } catch (err: any) {
        console.error("Erro:", err);
        setError(err.response?.data?.error || "Erro desconhecido");
      }
    }

    if (view !== "zip") carregarDados();
  }, [view]);

  useEffect(() => {
    //apenas define a view "database" como default sem buscar dados
    if (view === "database") {
      setDbResults([]);
      setDbProgress(null);
    }
  }, [view]);



  const handleDownloadZip = async () => {
    if (!fromDate || !toDate) {
      alert("Preencha as duas datas para baixar o ZIP.");
      return;
    }

    try {
      setProgress(0);
      const evtSource = new EventSource(`/api/download-zip/progress?from_date=${fromDate}&to_date=${toDate}`);

      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (typeof data.progress === "number") {
          setProgress(data.progress);
        }

        if (data.complete) {
          evtSource.close();

          // baixa o ZIP final quando completo
          axios
            .get(`/api/download-zip?from_date=${fromDate}&to_date=${toDate}`, {
              responseType: "blob",
            })
            .then((res) => {
              const blob = new Blob([res.data], { type: "application/zip" });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", `envelopes_${fromDate}_a_${toDate}.zip`);
              document.body.appendChild(link);
              link.click();
              link.remove();
              setProgress(null);
            })
            .catch((err) => {
              console.error("Erro ao baixar o ZIP:", err);
              alert("Erro ao baixar os arquivos.");
              setProgress(null);
            });
        }
      };

      evtSource.onerror = (err) => {
        console.error("Erro no progresso do download:", err);
        evtSource.close();
        alert("Erro durante o progresso do download.");
        setProgress(null);
      };
    } catch (err) {
      console.error("Erro ao iniciar o download:", err);
      alert("Erro ao iniciar o download.");
      setProgress(null);
    }
  };

  console.log("Enviando filtros para /api/envelopes:", { fromDate, toDate });

  console.log({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
  });

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Dashboard DocuSign</h1>

      <div className="mb-6">
        <label className="block mb-2 font-semibold">Escolha o que deseja visualizar:</label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as "user" | "envelopes" | "zip" | "database")}
          className="border border-transparent rounded px-4 py-2 w-full shadow-md hover:border-gray-200"
        >
          <option value="database">Consulta no Banco de Dados</option>
          {/*<option value="user">Informações do Usuário</option>*/}
          <option value="envelopes">Consulta na Docusign</option>
          {/*<option value="zip">Baixar Todos (ZIP)</option>*/}
        </select>
      </div>

      {error && <p className="text-red-500">Erro: {error}</p>}

      {/*{dbProgress === null && (
        <span className="font-semibold text-lg mb-5">{`Total de registros: ${envelopes.length}`}</span>
      )}*/}

      {
        view === "envelopes" && envProgress !== null && (
          <div className="mt-6 w-full max-w-md mx-auto text-center">
            <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden shadow-md">
              <div
                className="absolute top-0 left-0 h-full transition-all duration-500 ease-out"
                style={{
                  width: `${envProgress}%`,
                  background: `linear-gradient(90deg, #4ade80, #16a34a)`,
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                {envProgress}% carregado
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2 mb-2 animate-pulse">
              Aguarde, carregando registros da Docusign...
            </p>
          </div>
        )
      }

      {view === "envelopes" && (
        <>
          <div className="border border-gray-200 p-6 rounded bg-gray-50">
            <h2 className="text-lg font-semibold mb-4">Consulta de Envelopes na Docusign</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 items-end">
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
              <div>
                <button
                  onClick={async () => {
                    try {
                      setError(null);
                      setenvProgress(10);

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

                      let envelopesFiltrados = res.data.envelopes || [];

                      if (statusFilter.trim() !== "") {
                        envelopesFiltrados = envelopesFiltrados.filter((env: any) =>
                          env.status?.toLowerCase().includes(statusFilter.toLowerCase())
                        );
                      }

                      if (responsavelFilter.trim() !== "") {
                        envelopesFiltrados = envelopesFiltrados.filter((env: any) =>
                          env.sender?.userName?.toLowerCase().includes(responsavelFilter.toLowerCase())
                        );
                      }

                      setEnvelopes(envelopesFiltrados);
                      setPaginaAtual(1);

                      let fakeProgress = 10;
                      const interval = setInterval(() => {
                        fakeProgress += 10;
                        if (fakeProgress >= 100) {
                          clearInterval(interval);
                          setenvProgress(100);
                          setTimeout(() => setenvProgress(null), 500);
                        } else {
                          setenvProgress(fakeProgress);
                        }
                      }, 100);
                    } catch (err: any) {
                      console.error("Erro ao buscar envelopes:", err);
                      setError("Erro ao buscar envelopes.");
                      setenvProgress(null);
                    }
                  }}
                  className="bg-green-700 text-white font-semibold px-6 py-2 rounded hover:bg-green-800 cursor-pointer hover:shadow-md"
                >
                  Buscar
                </button>
              </div>
            </div>

            {envelopes.length > 0 && (
              <>
                {fromDate && toDate && (
                  <p className="text-sm text-gray-700 font-medium mt-4 mb-4 text-center">
                    {envelopes.length} envelopes encontrados entre{" "}
                    {new Date(fromDate).toLocaleDateString("pt-BR")} e{" "}
                    {new Date(toDate).toLocaleDateString("pt-BR")}.
                  </p>
                )}
                <div className="flex justify-between items-center mb-4 mt-4">
                  <button
                    onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                    className="px-4 py-2 bg-gray-300 font-semibold rounded disabled:opacity-50 hover:shadow-md cursor-pointer hover:bg-blue-400 hover:text-white"
                    disabled={paginaAtual === 1}
                  >
                    Anterior
                  </button>

                  <span className="text-sm font-medium text-gray-700">
                    Página {paginaAtual} de {Math.ceil(envelopes.length / itensPorPagina)}
                  </span>

                  <button
                    onClick={() =>
                      setPaginaAtual((prev) =>
                        prev * itensPorPagina < envelopes.length ? prev + 1 : prev
                      )
                    }
                    className="px-4 py-2 bg-gray-300 font-semibold rounded disabled:opacity-50 hover:shadow-md cursor-pointer hover:bg-blue-400 hover:text-white"
                    disabled={paginaAtual * itensPorPagina >= envelopes.length}
                  >
                    Próxima
                  </button>
                </div>

                <table className="table-auto w-full border border-gray-300 mt-4">
                  <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                    <tr className="bg-gray-100">
                      <th
                        onClick={() => setOrdenacaoDataAsc((prev) => !prev)}
                        className="border px-4 py-2 text-left cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          Data
                          {ordenacaoDataAsc ? (
                            <ArrowDownAZ className="w-4 h-4 text-blue-700" />
                          ) : (
                            <ArrowUpZA className="w-4 h-4 text-blue-700" />
                          )}
                        </div>
                      </th>

                      <th className="border px-4 py-2 text-left">Assunto</th>
                      <th className="border px-4 py-2 text-left">Status</th>
                      <th className="border px-4 py-2 text-left">PDF</th>
                      <th className="border px-4 py-2 text-left">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {envelopesPaginados.map((env) => (
                      <tr key={env.envelopeId} className="hover:bg-gray-50 transition">
                        <td className="border px-4 py-2">
                          {env.createdDateTime
                            ? new Date(env.createdDateTime).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="border px-4 py-3">{env.emailSubject || "Sem assunto"}</td>
                        <td className="border px-4 py-3 capitalize">{env.status}</td>
                        <td className="border px-4 py-3 grid items-center text-center">
                          <a
                            href={`/api/download-pdf?envelopeId=${env.envelopeId}`}
                            target="_blank"
                            className="text-blue-700 hover:underline flex items-center gap-1">
                            <Download className="w-4 h-4" /> Baixar
                          </a>
                          <a
                            href={`https://app.docusign.com/documents/details/${env.envelopeId}`}
                            target="_blank"
                            className="text-green-700 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-4 h-4" /> Abrir
                          </a>
                        </td>
                        <td className="border px-4 py-2 capitalize">{env.sender?.userName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {
        view === "zip" && (
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
        )
      }
      {
        progress !== null && (
          <div className="mt-4">
            <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700 ease-in-out"
                style={{
                  width: `${(progress / totalLotes) * 100}%`,
                }}
              />
            </div>
            <p className="text-center text-sm text-gray-700 mt-2">
              Buscando ZIPs: {progress} de {totalLotes}
            </p>
          </div>
        )
      }
      {
        view === "database" && dbProgress !== null && (
          <div className="mt-6 w-full max-w-md mx-auto text-center">
            <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden shadow-md">
              <div
                className="absolute top-0 left-0 h-full transition-all duration-500 ease-out"
                style={{
                  width: `${dbProgress}%`,
                  background: `linear-gradient(90deg, #4ade80, #16a34a)`,
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                {dbProgress}% carregado
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2 mb-2 animate-pulse">
              Aguarde, carregando registros do banco de dados...
            </p>
          </div>
        )
      }


      {
        view === "database" && (
          <div className="border border-gray-200 p-6 rounded bg-gray-50">
            <h2 className="text-lg font-semibold mb-4">Consulta de Envelopes no Banco</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 items-end">
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
                  setDbProgress(10);
                  const res = await axios.get(`/api/database-envelopes`, {
                    params: {
                      from_date: fromDate || undefined,
                      to_date: toDate || undefined,
                      status: statusFilter || undefined,
                      responsavel: responsavelFilter || undefined,
                    },
                  });
                  console.log("📦 Resultados do banco:", res.data);
                  setDbResults(res.data);
                  setPaginaAtual(1);

                  let fakeProgress = 10;
                  const interval = setInterval(() => {
                    fakeProgress += 10;
                    if (fakeProgress >= 100) {
                      clearInterval(interval);
                      setDbProgress(100);
                      setTimeout(() => setDbProgress(null), 1000);
                    } else {
                      setDbProgress(fakeProgress);
                    }
                  }, 100);

                } catch (err) {
                  console.error("Erro ao consultar o banco:", err);
                  alert("Erro ao buscar envelopes do banco.");
                  setDbProgress(null);
                }
              }}

              className="bg-green-700 text-white font-semibold px-6 py-2 rounded hover:bg-green-800 cursor-pointer hover:shadow-md"
            >
              Buscar
            </button>

            {dbResults.length > 0 && (
              <>
                {fromDate && toDate && (
                  <p className="text-sm text-gray-700 font-medium mt-4 mb-4 text-center">
                    {dbResults.length} envelopes encontrados entre{" "}
                    {new Date(fromDate).toLocaleDateString("pt-BR")} e{" "}
                    {new Date(toDate).toLocaleDateString("pt-BR")}.
                  </p>
                )}

                <div className="flex justify-between items-center mb-4 mt-4">
                  <button
                    onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                    className="px-4 py-2 bg-gray-300 font-semibold rounded disabled:opacity-50 hover:shadow-md cursor-pointer hover:bg-blue-400 hover:text-white"
                    disabled={paginaAtual === 1}
                  >
                    Anterior
                  </button>

                  <span className="text-sm font-medium text-gray-700">
                    Página {paginaAtual} de {Math.ceil(dbResults.length / itensPorPagina)}
                  </span>

                  <button
                    onClick={() =>
                      setPaginaAtual((prev) =>
                        prev * itensPorPagina < dbResults.length ? prev + 1 : prev
                      )
                    }
                    className="px-4 py-2 bg-gray-300 font-semibold rounded disabled:opacity-50 hover:shadow-md cursor-pointer hover:bg-blue-400 hover:text-white"
                    disabled={paginaAtual * itensPorPagina >= dbResults.length}
                  >
                    Próxima
                  </button>
                </div>

                <table className="table-auto w-full border border-gray-300 mt-6">
                  <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                    <tr className="bg-gray-100">
                      <th className="border px-4 py-2 text-left">Data</th>
                      <th className="border px-4 py-2 text-left">Assunto</th>
                      <th className="border px-4 py-2 text-left">Status</th>
                      <th className="border px-4 py-2 text-left">Responsável</th>
                      <th className="border px-4 py-2 text-left">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbResultsPaginados.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-100 transition-colors duration-200">
                        <td className="border px-4 py-2">
                          {item.CREATED_AT
                            ? new Date(item.CREATED_AT).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="border px-4 py-3">{item.EMAIL_SUBJECT}</td>
                        <td className="border px-4 py-3">{item.STATUS}</td>
                        <td className="border px-4 py-3">{item.RESPONSAVEL_NOME}</td>
                        <td className="border px-4 py-3 grid items-center text-center">
                          <a
                            href={`/api/download-from-db?envelopeId=${item.ENVELOPE_ID}`}
                            target="_blank"
                            className="text-blue-700 hover:underline flex items-center gap-1">
                            <Download className="w-4 h-4" /> Baixar
                          </a>
                          <a
                            href={`/api/download-from-db?envelopeId=${item.ENVELOPE_ID}&inline=true`}
                            target="_blank"
                            className="text-green-700 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-4 h-4" /> Abrir
                          </a>

                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )
      }
    </div >
  );
}