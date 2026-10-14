// ====================================================================
// BIBLIOTECA DE MOBILIDADE
// Os movimentos que o teste mede e os exercícios que a rotina usa.
// Só dados: não mexe na tela e não depende de nada.
//
// Os exercícios aqui são drills genéricos e conhecidos, descritos com
// palavras próprias. Vale revisar com um treinador ou fisioterapeuta.
// ====================================================================

export const REGIOES = {
  ombros: 'Ombros',
  overhead: 'Overhead',
  torax: 'Tórax',
  quadris: 'Quadris',
  cadeiaPosterior: 'Cadeia posterior',
  tornozelos: 'Tornozelos',
};

// lados: true  -> o teste mede esquerda e direita
// lados: false -> um valor só
export const MOVIMENTOS = {
  ombro_rot_interna:     { nome: 'Ombros: rotação interna',           regiao: 'ombros',          lados: true },
  ombro_rot_externa:     { nome: 'Ombros: rotação externa',           regiao: 'ombros',          lados: true },
  overhead:              { nome: 'Overhead',                          regiao: 'overhead',        lados: false },
  torax_rotacao:         { nome: 'Tórax: rotação',                    regiao: 'torax',           lados: true },
  quadris:               { nome: 'Quadris',                           regiao: 'quadris',         lados: false },
  cadeia_posterior_flex: { nome: 'Cadeia posterior: flexibilidade',   regiao: 'cadeiaPosterior', lados: true },
  tornozelo_flexao:      { nome: 'Tornozelos: flexão',                regiao: 'tornozelos',      lados: true },
};

const TODAS = ['corrida', 'musculacao', 'futevolei'];

// Campos de cada exercício:
//  tipos        'ativar' | 'recuperar' | 'diario'
//  modalidades  em quais modalidades faz sentido
//  partes       'full' = geral, serve para qualquer parte do corpo
//  movimentos   quais movimentos do teste ele trabalha ([] = nenhum)
//  modo         'passivo' | 'ativo' | 'ativacao' | 'relaxamento'
//  postura      'chao' | 'joelhos' | 'em_pe'
//  porLado      true = o tempo vale para cada lado (custa o dobro)
//  segundos     por lado, quando porLado; senão total
export const EXERCICIOS = [
  // ---- cadeia posterior ----
  {
    id: 'flexao_em_pe', nome: 'Flexão de tronco em pé',
    tipos: ['diario', 'recuperar'], modalidades: TODAS, partes: ['pernas', 'costas'],
    movimentos: ['cadeia_posterior_flex'], modo: 'passivo', postura: 'em_pe', porLado: false, segundos: 45,
    instrucao: 'Em pé, joelhos levemente dobrados. Deixe o tronco pender e a cabeça solta. Respire devagar.',
  },
  {
    id: 'isquios_deitado', nome: 'Posterior da coxa deitado',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['cadeia_posterior_flex'], modo: 'passivo', postura: 'chao', porLado: true, segundos: 40,
    instrucao: 'Deitado de costas, passe uma toalha no pé e leve a perna esticada para cima até sentir a parte de trás da coxa alongar.',
  },
  {
    id: 'balanco_perna', nome: 'Balanço de perna',
    tipos: ['ativar'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['cadeia_posterior_flex', 'quadris'], modo: 'ativo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Apoie uma mão na parede e balance a perna esticada para frente e para trás, aumentando a amplitude aos poucos.',
  },
  {
    id: 'bom_dia_leve', nome: 'Bom dia sem carga',
    tipos: ['ativar'], modalidades: ['corrida', 'musculacao'], partes: ['pernas', 'costas'],
    movimentos: ['cadeia_posterior_flex'], modo: 'ativacao', postura: 'em_pe', porLado: false, segundos: 45,
    instrucao: 'Mãos atrás da cabeça, joelhos levemente dobrados. Leve o quadril para trás inclinando o tronco com a coluna reta, e volte.',
  },
  {
    id: 'minhoca', nome: 'Caminhada da minhoca',
    tipos: ['ativar', 'diario'], modalidades: TODAS, partes: ['full', 'ombros', 'pernas'],
    movimentos: ['cadeia_posterior_flex', 'overhead'], modo: 'ativo', postura: 'em_pe', porLado: false, segundos: 45,
    instrucao: 'Em pé, leve as mãos ao chão e caminhe com elas até a posição de prancha. Volte caminhando e suba.',
  },
  {
    id: 'cachorro_olhando_baixo', nome: 'Cachorro olhando para baixo',
    tipos: ['diario', 'recuperar'], modalidades: TODAS, partes: ['pernas', 'ombros', 'costas'],
    movimentos: ['cadeia_posterior_flex', 'tornozelo_flexao', 'overhead'], modo: 'passivo', postura: 'joelhos', porLado: false, segundos: 45,
    instrucao: 'Mãos e pés no chão, quadril alto, formando um V invertido. Empurre o chão e leve os calcanhares em direção ao solo.',
  },

  // ---- ombros e overhead ----
  {
    id: 'dorminhoco', nome: 'Alongamento do dorminhoco',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['ombros'],
    movimentos: ['ombro_rot_interna'], modo: 'passivo', postura: 'chao', porLado: true, segundos: 40,
    instrucao: 'Deitado de lado sobre o ombro, cotovelo a 90 graus à frente. Com a outra mão, empurre o antebraço de leve em direção ao chão. Pare no primeiro desconforto.',
  },
  {
    id: 'ombro_cruzado', nome: 'Ombro cruzado no peito',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['ombros', 'bracos'],
    movimentos: ['ombro_rot_interna'], modo: 'passivo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Leve um braço esticado por cima do peito e puxe com o outro, sem girar o tronco.',
  },
  {
    id: 'rot_interna_toalha', nome: 'Rotação interna com toalha',
    tipos: ['diario', 'recuperar'], modalidades: TODAS, partes: ['ombros'],
    movimentos: ['ombro_rot_interna'], modo: 'passivo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Segure uma toalha atrás das costas. Com a mão de baixo, puxe a toalha devagar para baixo, sentindo o ombro de cima alongar.',
  },
  {
    id: 'circulos_braco', nome: 'Círculos de braço',
    tipos: ['ativar'], modalidades: TODAS, partes: ['ombros', 'bracos'],
    movimentos: ['ombro_rot_interna', 'ombro_rot_externa'], modo: 'ativo', postura: 'em_pe', porLado: false, segundos: 30,
    instrucao: 'Braços abertos, círculos pequenos que vão aumentando. Metade do tempo para cada sentido.',
  },
  {
    id: 'deslizamento_parede', nome: 'Deslizamento na parede',
    tipos: ['ativar', 'diario'], modalidades: TODAS, partes: ['ombros', 'costas', 'peitoral'],
    movimentos: ['overhead'], modo: 'ativacao', postura: 'em_pe', porLado: false, segundos: 45,
    instrucao: 'Costas, cabeça e lombar na parede, braços dobrados em W. Deslize os braços para cima sem descolar as costas.',
  },
  {
    id: 'peitoral_batente', nome: 'Peitoral no batente',
    tipos: ['recuperar', 'diario'], modalidades: ['musculacao', 'futevolei'], partes: ['peitoral', 'ombros'],
    movimentos: ['overhead'], modo: 'passivo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Antebraço apoiado no batente da porta, cotovelo na altura do ombro. Gire o corpo para o lado oposto.',
  },
  {
    id: 'crianca', nome: 'Postura da criança com braços à frente',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['costas', 'ombros'],
    movimentos: ['overhead'], modo: 'passivo', postura: 'joelhos', porLado: false, segundos: 45,
    instrucao: 'Sente sobre os calcanhares, estenda os braços à frente e deixe o peito descer em direção ao chão.',
  },
  {
    id: 'dorsal_apoio', nome: 'Dorsal com apoio',
    tipos: ['recuperar'], modalidades: ['musculacao'], partes: ['costas'],
    movimentos: ['overhead'], modo: 'passivo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Segure em um apoio firme, leve o quadril para trás e deixe o tronco descer, sentindo o lado das costas alongar.',
  },
  {
    id: 'triceps_alongamento', nome: 'Alongamento de tríceps',
    tipos: ['recuperar'], modalidades: ['musculacao'], partes: ['bracos'],
    movimentos: ['overhead'], modo: 'passivo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Cotovelo para cima, mão desce pelas costas. A outra mão empurra o cotovelo com suavidade.',
  },
  {
    id: 'punhos', nome: 'Mobilidade de punhos',
    tipos: ['ativar'], modalidades: ['musculacao'], partes: ['bracos'],
    movimentos: [], modo: 'ativo', postura: 'joelhos', porLado: false, segundos: 30,
    instrucao: 'Em quatro apoios, mãos no chão, balance o peso para frente e para trás e faça pequenos giros com os punhos.',
  },

  // ---- tórax ----
  {
    id: 'livro_aberto', nome: 'Livro aberto',
    tipos: ['ativar', 'diario', 'recuperar'], modalidades: TODAS, partes: ['costas', 'peitoral', 'ombros'],
    movimentos: ['torax_rotacao'], modo: 'ativo', postura: 'chao', porLado: true, segundos: 40,
    instrucao: 'Deitado de lado, joelhos dobrados. Abra o braço de cima em arco até o outro lado, seguindo a mão com o olhar.',
  },
  {
    id: 'rot_torax_quatro_apoios', nome: 'Rotação de tórax em quatro apoios',
    tipos: ['ativar', 'diario'], modalidades: TODAS, partes: ['costas'],
    movimentos: ['torax_rotacao'], modo: 'ativo', postura: 'joelhos', porLado: true, segundos: 40,
    instrucao: 'Uma mão atrás da cabeça. Gire o cotovelo para baixo, passando por baixo do corpo, e depois para o teto.',
  },
  {
    id: 'gato_camelo', nome: 'Gato e camelo',
    tipos: ['ativar', 'diario', 'recuperar'], modalidades: TODAS, partes: ['costas'],
    movimentos: ['torax_rotacao'], modo: 'ativo', postura: 'joelhos', porLado: false, segundos: 45,
    instrucao: 'Em quatro apoios, alterne arredondar e arquear a coluna, devagar, acompanhando a respiração.',
  },
  {
    id: 'rot_tronco_em_pe', nome: 'Rotação de tronco em pé',
    tipos: ['ativar'], modalidades: ['corrida', 'futevolei'], partes: ['costas', 'full'],
    movimentos: ['torax_rotacao'], modo: 'ativo', postura: 'em_pe', porLado: false, segundos: 30,
    instrucao: 'Pés na largura do quadril. Gire o tronco com os braços soltos para um lado e para o outro.',
  },
  {
    id: 'torcao_sentada', nome: 'Torção sentada',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['costas'],
    movimentos: ['torax_rotacao', 'quadris'], modo: 'passivo', postura: 'chao', porLado: true, segundos: 30,
    instrucao: 'Sentado, perna cruzada por cima da outra. Gire o tronco para o lado da perna de cima, com a coluna alta.',
  },

  // ---- quadris ----
  {
    id: 'noventa_noventa', nome: '90/90 de quadril',
    tipos: ['ativar', 'diario', 'recuperar'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['quadris'], modo: 'ativo', postura: 'chao', porLado: true, segundos: 40,
    instrucao: 'Sentado com as duas pernas a 90 graus. Mantenha o tronco alto e incline em direção à perna da frente.',
  },
  {
    id: 'flexor_quadril', nome: 'Flexor do quadril em afundo',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['quadris'], modo: 'passivo', postura: 'joelhos', porLado: true, segundos: 40,
    instrucao: 'Joelho de trás no chão. Contraia o glúteo desse lado e leve o quadril um pouco à frente.',
  },
  {
    id: 'afundo_rotacao', nome: 'Afundo com rotação',
    tipos: ['ativar'], modalidades: TODAS, partes: ['pernas', 'costas', 'full'],
    movimentos: ['quadris', 'torax_rotacao'], modo: 'ativo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Dê um passo à frente em afundo e gire o tronco para o lado da perna da frente. Volte e troque.',
  },
  {
    id: 'agachamento_profundo', nome: 'Agachamento profundo com cotovelos',
    tipos: ['ativar', 'diario'], modalidades: TODAS, partes: ['pernas', 'full'],
    movimentos: ['quadris', 'tornozelo_flexao'], modo: 'ativo', postura: 'em_pe', porLado: false, segundos: 45,
    instrucao: 'Agache o mais fundo que conseguir, calcanhares no chão, cotovelos empurrando os joelhos para fora.',
  },
  {
    id: 'borboleta', nome: 'Borboleta',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['quadris'], modo: 'passivo', postura: 'chao', porLado: false, segundos: 45,
    instrucao: 'Sentado, solas dos pés juntas e joelhos para os lados. Incline o tronco à frente com a coluna longa.',
  },
  {
    id: 'pombo', nome: 'Pombo',
    tipos: ['recuperar'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['quadris'], modo: 'passivo', postura: 'chao', porLado: true, segundos: 40,
    instrucao: 'A partir de quatro apoios, leve um joelho para a frente e para o lado e estenda a outra perna para trás. Incline o tronco à frente.',
  },
  {
    id: 'ponte_gluteo', nome: 'Ponte de glúteo',
    tipos: ['ativar'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['quadris', 'cadeia_posterior_flex'], modo: 'ativacao', postura: 'chao', porLado: false, segundos: 45,
    instrucao: 'Deitado, joelhos dobrados e pés no chão. Suba o quadril apertando o glúteo e desça devagar.',
  },
  {
    id: 'passo_lateral', nome: 'Passo lateral agachado',
    tipos: ['ativar'], modalidades: ['corrida', 'futevolei'], partes: ['pernas'],
    movimentos: ['quadris'], modo: 'ativacao', postura: 'em_pe', porLado: false, segundos: 30,
    instrucao: 'Em meio agachamento, caminhe de lado mantendo os joelhos alinhados com os pés.',
  },
  {
    id: 'abertura_pernas', nome: 'Abertura de pernas sentado',
    tipos: ['diario', 'recuperar'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['quadris'], modo: 'passivo', postura: 'chao', porLado: false, segundos: 45,
    instrucao: 'Sentado, pernas esticadas e abertas até onde for confortável. Incline o tronco à frente sem dobrar os joelhos.',
  },
  {
    id: 'joelho_ao_peito', nome: 'Joelho ao peito',
    tipos: ['recuperar', 'diario'], modalidades: TODAS, partes: ['costas', 'pernas'],
    movimentos: ['quadris'], modo: 'passivo', postura: 'chao', porLado: true, segundos: 30,
    instrucao: 'Deitado de costas, abrace um joelho contra o peito mantendo a outra perna apoiada no chão.',
  },
  {
    id: 'elevacao_joelhos', nome: 'Elevação de joelhos alternada',
    tipos: ['ativar'], modalidades: ['corrida', 'futevolei'], partes: ['pernas', 'full'],
    movimentos: ['quadris'], modo: 'ativo', postura: 'em_pe', porLado: false, segundos: 30,
    instrucao: 'Em pé, suba um joelho de cada vez em ritmo leve, com o tronco alto.',
  },

  // ---- tornozelos ----
  {
    id: 'joelho_parede', nome: 'Joelho na parede',
    tipos: ['ativar', 'diario'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['tornozelo_flexao'], modo: 'ativo', postura: 'em_pe', porLado: true, segundos: 30,
    instrucao: 'Pé a poucos centímetros da parede. Leve o joelho até tocar a parede sem tirar o calcanhar do chão.',
  },
  {
    id: 'panturrilha_parede', nome: 'Panturrilha na parede',
    tipos: ['recuperar', 'diario'], modalidades: ['corrida', 'futevolei'], partes: ['pernas'],
    movimentos: ['tornozelo_flexao'], modo: 'passivo', postura: 'em_pe', porLado: true, segundos: 40,
    instrucao: 'Mãos na parede, uma perna esticada atrás com o calcanhar no chão. Incline o corpo para a parede.',
  },
  {
    id: 'circulos_tornozelo', nome: 'Círculos de tornozelo',
    tipos: ['ativar'], modalidades: TODAS, partes: ['pernas'],
    movimentos: ['tornozelo_flexao'], modo: 'ativo', postura: 'chao', porLado: true, segundos: 20,
    instrucao: 'Sentado, perna esticada. Desenhe círculos grandes com o pé, nos dois sentidos.',
  },
  {
    id: 'soleo_parede', nome: 'Sóleo com joelho dobrado',
    tipos: ['recuperar'], modalidades: ['corrida', 'futevolei'], partes: ['pernas'],
    movimentos: ['tornozelo_flexao'], modo: 'passivo', postura: 'em_pe', porLado: true, segundos: 40,
    instrucao: 'Mesma posição da panturrilha, mas dobre o joelho de trás mantendo o calcanhar no chão.',
  },
  {
    id: 'elevacao_calcanhar', nome: 'Elevação de calcanhar lenta',
    tipos: ['ativar'], modalidades: ['corrida', 'futevolei'], partes: ['pernas'],
    movimentos: ['tornozelo_flexao'], modo: 'ativacao', postura: 'em_pe', porLado: false, segundos: 30,
    instrucao: 'Em pé, suba nas pontas dos pés em dois segundos e desça em dois segundos.',
  },

  // ---- gerais ----
  {
    id: 'respiracao', nome: 'Respiração profunda deitado',
    tipos: ['recuperar'], modalidades: TODAS, partes: ['full'],
    movimentos: [], modo: 'relaxamento', postura: 'chao', porLado: false, segundos: 60,
    instrucao: 'Deitado, mãos na barriga. Inspire pelo nariz enchendo a barriga e solte devagar pela boca.',
  },
  {
    id: 'caminhada_leve', nome: 'Caminhada leve',
    tipos: ['recuperar'], modalidades: ['corrida', 'futevolei'], partes: ['full', 'pernas'],
    movimentos: [], modo: 'ativo', postura: 'em_pe', porLado: false, segundos: 60,
    instrucao: 'Caminhe devagar com os braços soltos, deixando a respiração e os batimentos baixarem.',
  },
];
