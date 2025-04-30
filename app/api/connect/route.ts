import oracledb from "oracledb";

async function testConnection() {
  try {
    const conn = await oracledb.getConnection({
      user: "SYSTEM",
      password: "Cr3$$3m00",
      connectString: "10.25.214.216:1521/CDB", // ajuste aqui se for XEPDB1
    });

    console.log("✅ Conectado!");
    await conn.close();
  } catch (err) {
    console.error("❌ Erro ao conectar:", err);
  }
}

testConnection();
