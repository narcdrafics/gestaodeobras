/**
 * Teste de Validação XSS para o Obra Real
 * Este script deve ser executado no console do navegador para validar
 * se a função safeSetInner e sanitizeHTML estão funcionando.
 */

(function testXSS() {
  console.log("%c--- Iniciando Teste de Segurança XSS ---", "font-weight:bold; color:var(--accent)");

  const testPayloads = [
    { name: "Script Tag", payload: "<script>alert('XSS Script')</script>", expected: "alert('XSS Script')" },
    { name: "Img Error", payload: "<img src=x onerror=alert('XSS_Img')>", expected: "src=\"x\"" },
    { name: "Inline Event", payload: "<div onclick='alert(1)'>Click me</div>", expected: "<div>Click me</div>" },
    { name: "JavaScript Protocol", payload: "<a href='javascript:alert(1)'>Link</a>", expected: "href=\"#\"" }
  ];

  const testContainer = document.createElement('div');
  testContainer.id = 'xss-test-container';
  testContainer.style.display = 'none';
  document.body.appendChild(testContainer);

  let results = [];

  testPayloads.forEach(t => {
    // Tenta renderizar usando safeSetInner
    window.safeSetInner(testContainer, t.payload);
    const renderedHTML = testContainer.innerHTML;
    
    // Verifica se contém strings perigosas
    const holdsScript = renderedHTML.toLowerCase().includes('<script');
    const holdsOnEvent = renderedHTML.toLowerCase().includes('onclick') || renderedHTML.toLowerCase().includes('onerror');
    const holdsJsProtocol = renderedHTML.toLowerCase().includes('javascript:');

    const passed = !holdsScript && !holdsOnEvent && !holdsJsProtocol;
    
    results.push({
      Cenário: t.name,
      Resultado: passed ? "✅ PASSOU" : "❌ FALHOU",
      HTML_Renderizado: renderedHTML
    });
  });

  console.table(results);

  if (results.every(r => r.Resultado === "✅ PASSOU")) {
    console.log("%c\nSUCESSO: Todas as tentativas de injeção foram mitigadas!", "color:green; font-weight:bold");
  } else {
    console.error("FALHA: Alguns vetores de XSS não foram bloqueados adequadamente.");
  }

  // Cleanup
  document.body.removeChild(testContainer);
})();
