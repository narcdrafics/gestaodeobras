const ETAPAS = [
  {
    etapa: 'Terraplanagem e Fundação',
    codigo: 'FUND',
    palavras: [
      'terraplana', 'terraplanagem', 'nivelar terreno', 'nivelar o terreno',
      'fundação', 'fundações', 'sapata', 'sapatas', 'blocos de fundação',
      'radier', 'baldrame', 'viga baldrame', 'estaca', 'estacas',
      'perfurar', 'sondagem', 'SPT', 'escavar', 'escavação',
      'aterro', 'compactação', 'compactar',
      'piso de concreto de fundação', 'lastro', 'lastro de concreto',
      'muro de arrimo', 'arrimo', 'contenção'
    ]
  },
  {
    etapa: 'Estrutura',
    codigo: 'ESTR',
    palavras: [
      'estrutura', 'estrutural', 'concreto armado', 'concretar',
      'laje', 'lajes', 'laje maciça', 'laje nervurada', 'laje steel deck',
      'viga', 'vigas', 'pilar', 'pilares', 'coluna', 'colunas',
      'forma', 'formas', 'fôrma', 'fôrmas', 'escoramento', 'escora',
      'armação', 'ferragem', 'ferro', 'aço', 'armadura',
      'concretagem', 'betonada', 'betonar',
      'estrutura metálica', 'metalon', 'perfil metálico',
      'laje pré-moldada', 'pré-laje', 'tavela', 'vigota'
    ]
  },
  {
    etapa: 'Alvenaria',
    codigo: 'ALVE',
    palavras: [
      'alvenaria', 'parede', 'paredes', 'muro', 'muros',
      'tijolo', 'tijolos', 'bloco', 'blocos', 'bloco cerâmico',
      'bloco de concreto', 'bloco sílico-calcário',
      'assentar', 'assentamento', 'levantar parede',
      'reboco', 'rebocar', 'chapisco', 'chapiscar', 'emboço',
      'massa', 'massa grossa', 'massa fina', 'gesso', 'gessar',
      'argamassa', 'regularização', 'regularizar',
      'contrapiso', 'fazer contrapiso',
      'drywall', 'gesso acartonado', 'divisória',
      'verga', 'contraverga', 'cinta', 'cinta de amarração',
      'revestimento externo', 'revestimento interno',
      'porcelanato', 'cerâmica', 'azulejo', 'revestir parede',
      'pastilha', 'pedra', 'granito', 'mármore', 'revestimento de pedra'
    ]
  },
  {
    etapa: 'Cobertura',
    codigo: 'COBE',
    palavras: [
      'cobertura', 'telhado', 'telha', 'telhas',
      'madeiramento', 'caibro', 'ripa', 'terça', 'cumeeira',
      'estrutura de madeira', 'tesoura', 'tesouras',
      'calha', 'calhas', 'rufos', 'rufo', 'pingadeira',
      'impermeabilizar telhado', 'impermeabilização de telhado',
      'manta asfáltica', 'manta', 'laje impermeável',
      'telha cerâmica', 'telha de fibrocimento', 'telha metálica',
      'telha shingle', 'telha thermoacústica',
      'platibanda', 'ático', 'beiral', 'beirado',
      'caixa d\'água', 'reservatório', 'cisterna'
    ]
  },
  {
    etapa: 'Hidrossanitário',
    codigo: 'HIDR',
    palavras: [
      'hidráulica', 'hidrossanitário', 'encanamento', 'encanar',
      'tubo', 'tubos', 'tubulação', 'cano', 'canos',
      'esgoto', 'rede de esgoto', 'ramal de esgoto',
      'água fria', 'água quente', 'ramal de água',
      'pvc', 'pprc', 'cobre', 'tubo de cobre',
      'registro', 'registros', 'válvula', 'válvulas',
      'louça', 'louças', 'bacia', 'vaso', 'sanitário',
      'pia', 'cuba', 'lavatório', 'tanque', 'banheira',
      'chuveiro', 'ducha', 'torneira', 'misturador',
      'sifão', 'ralo', 'caixa sifonada', 'caixa de gordura',
      'fossa', 'fossa séptica', 'sumidouro',
      'caixa de inspeção', 'poço de visita',
      'medidor de água', 'hidrômetro',
      'pressurização', 'bomba d\'água', 'bomba'
    ]
  },
  {
    etapa: 'Elétrica',
    codigo: 'ELET',
    palavras: [
      'elétrica', 'elétrico', 'eletricidade', 'instalação elétrica',
      'fiação', 'fio', 'fios', 'cabo', 'cabos', 'cabeamento',
      'eletroduto', 'conduite', 'conduíte',
      'quadro', 'quadro de luz', 'quadro elétrico', 'painel elétrico',
      'disjuntor', 'disjuntores', 'DR', 'DPS',
      'tomada', 'tomadas', 'interruptor', 'interruptores',
      'ponto de luz', 'pontos de luz', 'luminárias', 'luminária',
      'aterramento', 'spda', 'para-raios',
      'entrada de energia', 'poste', 'relógio de luz', 'medidor',
      'gerador', 'nobreak', 'estabilizador',
      'ar condicionado', 'split', 'instalação de ar',
      'alarme', 'câmera', 'CFTV', 'segurança eletrônica'
    ]
  },
  {
    etapa: 'Esquadrias',
    codigo: 'ESQU',
    palavras: [
      'esquadria', 'esquadrias', 'porta', 'portas', 'janela', 'janelas',
      'porta de madeira', 'porta de ferro', 'porta de alumínio',
      'janela de alumínio', 'janela de ferro', 'janela de madeira',
      'vidro', 'vidros', 'vidraça', 'temperado', 'blindex',
      'basculante', 'maxim-ar', 'veneziana', 'persiana',
      'portão', 'portões', 'grade', 'grades',
      'caixilho', 'marco', 'alizares', 'batente',
      'colocar porta', 'colocar janela', 'instalar esquadria',
      'guarita', 'portaria', 'controle de acesso'
    ]
  },
  {
    etapa: 'Revestimento e Acabamento',
    codigo: 'ACAB',
    palavras: [
      'acabamento', 'acabamentos', 'revestimento', 'revestimentos',
      'pintura', 'pintar', 'tinta', 'massa corrida', 'selador',
      'primer', 'lixar', 'lixa',
      'piso', 'pisos', 'colocar piso', 'assentar piso',
      'rodapé', 'soleira', 'peitoril',
      'forro', 'teto', 'forro de gesso', 'forro de PVC',
      'sancas', 'molduras', 'gesso decorativo',
      'marmorino', 'textura', 'grafiato',
      'polimento', 'polir', 'cristalização',
      'silicone', 'rejunte', 'rejuntar',
      'espelho', 'acessório de banheiro', 'toalheiro', 'papeleira'
    ]
  },
  {
    etapa: 'Instalações Especiais',
    codigo: 'ESPE',
    palavras: [
      'gás', 'instalação de gás', 'rede de gás', 'tubulação de gás',
      'aquecedor', 'aquecimento', 'boiler', 'aquecedor solar',
      'painel solar', 'energia solar', 'fotovoltaico',
      'automação', 'home automation', 'casa inteligente',
      'internet', 'rede lógica', 'cabeamento estruturado', 'fibra',
      'interfone', 'videofone', 'porteiro eletrônico',
      'elevador', 'plataforma elevatória',
      'sistema de incêndio', 'sprinkler', 'hidrante', 'extintor',
      'central de gás', 'medidor de gás'
    ]
  },
  {
    etapa: 'Urbanização e Paisagismo',
    codigo: 'URBA',
    palavras: [
      'paisagismo', 'jardim', 'jardinagem', 'grama', 'gramado',
      'planta', 'plantas', 'árvore', 'árvores',
      'calçada', 'calçamento', 'passeio', 'pavimentação',
      'paver', 'paralelepípedo', 'asfalto', 'asfaltar',
      'estacionamento', 'vaga de carro', 'garagem',
      'muro externo', 'cerca', 'alambrado',
      'piscina', 'churrasqueira', 'área gourmet', 'pergolado',
      'deck', 'deck de madeira', 'iluminação externa',
      'drenagem', 'sistema de drenagem', 'canaleta',
      'limpeza de obra', 'limpeza final', 'entulho'
    ]
  }
];

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectarEtapas(texto) {
  const textoNorm = normalizar(texto);
  const resultados = [];

  for (const etapa of ETAPAS) {
    let score = 0;
    const termosBatidos = [];

    for (const palavra of etapa.palavras) {
      const palavraNorm = normalizar(palavra);
      if (textoNorm.includes(palavraNorm)) {
        score += palavraNorm.split(' ').length;
        termosBatidos.push(palavra);
      }
    }

    if (score > 0) {
      resultados.push({
        etapa: etapa.etapa,
        codigo: etapa.codigo,
        score,
        termos: termosBatidos
      });
    }
  }

  return resultados.sort((a, b) => b.score - a.score);
}

function extrairTarefas(texto) {
  const sentencas = texto
    .split(/[,;\n.]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  const tarefas = [];

  for (const sentenca of sentencas) {
    const etapasDetectadas = detectarEtapas(sentenca);

    if (etapasDetectadas.length > 0) {
      const melhorEtapa = etapasDetectadas[0];

      tarefas.push({
        titulo: capitalize(sentenca),
        etapa: melhorEtapa.etapa,
        etapaCodigo: melhorEtapa.codigo,
        status: 'aberta',
        confianca: melhorEtapa.score >= 3 ? 'alta' : 'media',
        termosDetectados: melhorEtapa.termos,
        createdVia: 'whatsapp'
      });
    } else {
      if (sentenca.split(' ').length >= 2) {
        tarefas.push({
          titulo: capitalize(sentenca),
          etapa: null,
          etapaCodigo: null,
          status: 'aberta',
          confianca: 'baixa',
          createdVia: 'whatsapp'
        });
      }
    }
  }

  return tarefas;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

module.exports = { detectarEtapas, extrairTarefas, ETAPAS, normalizar };