fetch("https://us-central1-controle-obras-c889d.cloudfunctions.net/webhookPagamento", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "paid",
    customer_email: "bob.construtor.real@teste.com",
    customer_name: "Bob Engenharia SA"
  })
}).then(r => r.text()).then(t => console.log("Resposta do Webhook:", t)).catch(console.error);
