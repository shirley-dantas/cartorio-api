const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const data = JSON.stringify(JSON.parse(event.body));

  return new Promise((resolve) => {
    const req = https.request(
      "https://painel-cartorio-default-rtdb.firebaseio.com/casos.json",
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        resolve({ statusCode: 200, body: "OK" });
      }
    );
    req.write(data);
    req.end();
  });
};
