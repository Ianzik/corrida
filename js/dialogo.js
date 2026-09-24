// ====================================================================
// CAIXA DE DIÁLOGO
// Uma janela simples, reaproveitada para: pedir permissões, mostrar o
// passo a passo das configurações e exportar/importar o progresso.
// ====================================================================

const $ = id => document.getElementById(id);

// opcoes: {
//   titulo, texto, passos: [..],
//   campo: { valor, somenteLeitura, dica },   (caixa de texto opcional)
//   arquivo: true,                            (botão "Escolher arquivo")
//   botoes: [{ id, texto, principal, acao, fica }]
// }
// Um botão com "fica: true" executa a acao sem fechar a janela.
// Se a acao devolver um texto, ele aparece na janela; num botão sem
// "fica", texto significa erro e a janela também não fecha.
// Devolve uma Promise com { id, texto } do botão que fechou a janela.
export function mostrarDialogo(opcoes) {
  return new Promise(resolve => {
    $('dialogoTitulo').textContent = opcoes.titulo || '';
    $('dialogoTexto').textContent = opcoes.texto || '';
    $('dialogoAviso').textContent = '';

    const passos = $('dialogoPassos');
    passos.innerHTML = '';
    (opcoes.passos || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = p;
      passos.appendChild(li);
    });
    passos.hidden = !(opcoes.passos && opcoes.passos.length);

    const campo = $('dialogoCampo');
    campo.hidden = !opcoes.campo;
    campo.value = opcoes.campo ? opcoes.campo.valor || '' : '';
    campo.readOnly = !!(opcoes.campo && opcoes.campo.somenteLeitura);
    campo.placeholder = opcoes.campo ? opcoes.campo.dica || '' : '';

    const arquivo = $('dialogoArquivo');
    const rotuloArquivo = $('dialogoArquivoRotulo');
    rotuloArquivo.hidden = !opcoes.arquivo;
    arquivo.value = '';
    arquivo.onchange = () => {
      const f = arquivo.files && arquivo.files[0];
      if (!f) return;
      const leitor = new FileReader();
      leitor.onload = () => { campo.value = String(leitor.result || ''); };
      leitor.readAsText(f);
    };

    const areaBotoes = $('dialogoBotoes');
    areaBotoes.innerHTML = '';
    (opcoes.botoes || [{ id: 'ok', texto: 'Ok', principal: true }]).forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.texto;
      btn.className = b.principal ? 'dialogoPrincipal' : 'dialogoSecundario';
      btn.addEventListener('click', async () => {
        if (b.acao) {
          const msg = await b.acao(campo.value);
          if (typeof msg === 'string') {
            $('dialogoAviso').textContent = msg;
            if (!b.fica) return; // mensagem de erro: a janela fica aberta
          }
        }
        if (b.fica) return;
        $('dialogo').hidden = true;
        resolve({ id: b.id, texto: campo.value });
      });
      areaBotoes.appendChild(btn);
    });

    $('dialogo').hidden = false;
  });
}

export function avisoNoDialogo(texto) {
  $('dialogoAviso').textContent = texto;
}
