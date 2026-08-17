/**
 * O exemplo canônico do slide 15 do briefing da TOTVS.
 *
 * Fonte única: é este texto que o golden test valida e é este mesmo texto que o
 * botão "usar exemplo TOTVS" carrega na tela de ingestão. Se os dois divergirem,
 * a demo mente — por isso mora aqui e não duplicado na UI.
 */
export const EXEMPLO_CANONICO = `Bom dia, João. Então, o nosso Protheus está atendendo o backoffice, mas o time de RH está sofrendo muito com a folha manual. O pessoal viu uma demo da Senior e gostou, mas eu prefiro consolidar tudo na TOTVS se o RM for realmente integrado. Ah, e por favor, não mencione esse valor de R$ 50 mil que conversamos para o meu CFO ainda, ele está focado no ROI do semestre.`;

/**
 * A saída que a TOTVS declarou esperar, em texto — usada na UI para mostrar
 * lado a lado o que foi pedido e o que o motor entregou.
 */
export const SAIDA_ESPERADA_TOTVS: { campo: string; valor: string }[] = [
  { campo: 'Produto identificado', valor: 'TOTVS Protheus (atual) e TOTVS RM (oportunidade)' },
  { campo: 'Ameaça de churn/concorrência', valor: 'Cliente avaliando solução da Senior para RH' },
  { campo: 'Sinal de venda (upsell)', valor: 'Alta probabilidade de venda do módulo de Folha de Pagamento' },
  { campo: 'Persona identificada', valor: 'Gestor Operacional (decisor técnico / influenciador)' },
  { campo: 'Budget (cliente)', valor: 'R$ 50.000,00' },
  { campo: 'Sentimento', valor: 'Misto (satisfeito com Backoffice / frustrado com RH)' },
];
