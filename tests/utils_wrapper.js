/**
 * Wrapper ESM para testes unitários via vitest.
 * Re-exporta as funções do utils.module.js que são atribuídas ao window.
 * Este arquivo existe porque o utils.module.js é carregado como script normal
 * (não type="module") no navegador, impedindo o uso de export.
 */

// Simula um ambiente de navegador mínimo para que window.* funcione
if (typeof window === 'undefined') {
  globalThis.window = globalThis;
}

// Importa o arquivo (que popula window.*)
import '../public/js/utils.module.js?v=20261115003';

// Exporta do window para ESM
export const fmt = window.fmt;
export const fmtPct = window.fmtPct;
export const fmtDate = window.fmtDate;
export const summarizePresence = window.summarizePresence;
export const calcWeeklyPendingPayments = window.calcWeeklyPendingPayments;
export const summarizeFinance = window.summarizeFinance;
export const summarizeFinanceCosts = window.summarizeFinanceCosts;
export const buildFinanceEntries = window.buildFinanceEntries;
export const getPresencaCusto = window.getPresencaCusto;
export const calcBudgetProgress = window.calcBudgetProgress;
export const calcSaldo = window.calcSaldo;
export const estoqueStatus = window.estoqueStatus;
export const statusBadge = window.statusBadge;
export const uiEmptyState = window.uiEmptyState;
export const obName = window.obName;
export const nextCod = window.nextCod;
export const safeSetInner = window.safeSetInner;
export const autoBindTableLabels = window.autoBindTableLabels;
export const safeSetText = window.safeSetText;
export const safeSetValue = window.safeSetValue;
export const safeSetStyle = window.safeSetStyle;
export const escapeHTML = window.escapeHTML;
export const calcCustosDiarias = window.calcCustosDiarias;
export const calcCustosMedicoes = window.calcCustosMedicoes;
export const calcCustosFinanceiro = window.calcCustosFinanceiro;
export const getPeriodoOptions = window.getPeriodoOptions;
export const calcCustoObra = window.calcCustoObra;
export const calcDashboardResumo = window.calcDashboardResumo;
export const buildObraReport = window.buildObraReport;
export const normalizeAprovacao = window.normalizeAprovacao;
export const medicaoAprovacao = window.medicaoAprovacao;
export const budgetServiceKey = window.budgetServiceKey;
export const medicaoServiceKey = window.medicaoServiceKey;
export const normalizeServiceKey = window.normalizeServiceKey;
export const newServiceId = window.newServiceId;
export const migrateServiceIds = window.migrateServiceIds;
export const buildOrcamentoBoard = window.buildOrcamentoBoard;
export const buildMedicaoResumo = window.buildMedicaoResumo;
export const medicaoQuantidadeAnterior = window.medicaoQuantidadeAnterior;
export const hojeLocal = window.hojeLocal;
export const optimizeImageFile = window.optimizeImageFile;
export const auditSafeImage = window.auditSafeImage;
export const getObrasPermitidas = window.getObrasPermitidas;
export const filterDbByObras = window.filterDbByObras;
export const mergeScopedDb = window.mergeScopedDb;
export const parseObrasTrabalhador = window.parseObrasTrabalhador;
export const trabNaObra = window.trabNaObra;
export const obraNoEscopo = window.obraNoEscopo;
export const trabNoEscopo = window.trabNoEscopo;
export const trabalhadoresNoEscopo = window.trabalhadoresNoEscopo;
