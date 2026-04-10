"use client";

import React from "react";
import { Card, Col, Row, Statistic, Typography, Table, Progress, Tag, Alert, Button } from "antd";
import { ToolOutlined, WarningOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function DashboardOverview() {
  const { data, loading } = useTenantData();

  if (loading) {
    return <div style={{ padding: 24 }}>Carregando dados da Obra...</div>;
  }

  // == 1. Contadores Básicos ==
  const obrasAtivas = data.obras.filter(o => ['Em andamento', 'Planejada'].includes(o?.status));
  const tarefasPendentes = data.tarefas.filter(t => t?.status !== 'Concluída');

  // == 2. Cálculos Financeiros Consolidados (Mês Atual) ==
  const monthStr = dayjs().format('YYYY-MM'); 
  const financMes = data.financeiro.filter(f => f?.data?.startsWith(monthStr));
  const comprasMes = data.compras.filter(c => c?.data?.startsWith(monthStr));
  
  const despesasFinanceiro = financMes.filter(f => f?.tipo === 'Saída' || !f?.tipo).reduce((acc, f) => acc + (Number(f?.real) || 0), 0);
  const despesasCompras = comprasMes.reduce((acc, c) => acc + (Number(c?.vtotal) || 0), 0);
  const despesasMes = despesasFinanceiro + despesasCompras;
  
  // == 3. Cálculos de RH e Diárias Semanal ==
  const strSemana = dayjs().startOf('week').format('YYYY-MM-DD'); 
  const presencaSemana = data.presenca.filter(p => p?.data && p.data >= strSemana);
  const totalDiariasSemana = presencaSemana.reduce((acc, p) => acc + (Number(p?.total) || 0), 0);

  // == 4. Progresso Físico Médio (Baseado em Medições das Obras Ativas) ==
  const medicoesAtivas = data.medicao.filter(m => obrasAtivas.some(o => o.cod === m.obra));
  const avgAvancoProd = medicoesAtivas.length > 0 
    ? Math.round(medicoesAtivas.reduce((acc, m) => acc + (Number(m.avanco) || 0), 0) / medicoesAtivas.length)
    : 0;
  
  // Backup se não houver medições: usar tarefas
  const pctTarefas = data.tarefas.length > 0 
    ? Math.round((data.tarefas.filter(t => t?.status === 'Concluída').length / data.tarefas.length) * 100) 
    : 0;

  const progressoExibicao = medicoesAtivas.length > 0 ? avgAvancoProd : pctTarefas;

  // Montar lista rápida para as obras em andamento
  const columnsObras = [
    { title: 'Obra', dataIndex: 'nome', key: 'nome', render: (t: string) => <b>{t}</b> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'Em andamento' ? 'blue' : 'default'}>{status}</Tag> },
    { title: 'Orçamento', dataIndex: 'orc', key: 'orc', render: (val: number) => `R$ ${(Number(val)||0).toLocaleString('pt-BR')}` },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Visão Geral</Title>
        <Text type="secondary">Métricas consolidadas de todas as suas obras.</Text>
      </div>

      {obrasAtivas.length === 0 && (
         <Alert title="Nenhuma obra ativa encontrada. Comece cadastrando uma nova obra!" type="info" showIcon style={{ marginBottom: 24 }} />
      )}

      {/* Grid de Estatísticas Topo */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <Statistic title="Obras Ativas" value={obrasAtivas.length} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <Statistic 
              title="Custo Mês Atual" 
              value={despesasMes} 
              precision={2} 
              prefix="R$" 
              styles={{ content: { color: '#cf1322' } }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <Statistic 
              title="Diárias na Semana" 
              value={totalDiariasSemana} 
              precision={2} 
              prefix="R$" 
              styles={{ content: { color: '#d48806' } }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" style={{ boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <Statistic title="Tarefas em Aberto" value={tarefasPendentes.length} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Progresso de Tarefas Geral */}
        <Col xs={24} lg={8}>
          <Card variant="borderless" title="Avanço Físico Global" style={{ height: '100%', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress 
                type="dashboard" 
                percent={progressoExibicao} 
                size={180} 
                strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
              />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">{medicoesAtivas.length > 0 ? "Média de Avanço das Medições" : "Baseado em Tarefas Concluídas"}</Text>
              </div>
            </div>
          </Card>
        </Col>
        
        {/* Top Obras */}
        <Col xs={24} lg={16}>
          <Card variant="borderless" title="Status das Obras Ativas" style={{ height: '100%', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <Table 
              dataSource={obrasAtivas.map(o => {
                  const mObra = data.medicao.filter(m => m.obra === o.cod);
                  const avObra = mObra.length > 0 ? Math.round(mObra.reduce((acc, m) => acc + Number(m.avanco || 0), 0) / mObra.length) : 0;
                  return { ...o, avanco: avObra, key: o.cod || o.nome };
              })} 
              columns={[
                ...columnsObras,
                { title: 'Avanço', dataIndex: 'avanco', key: 'avanco', render: (v: number) => <Progress percent={v} size="small" /> }
              ]} 
              pagination={false} 
              size="middle"
            />
          </Card>
        </Col>
      </Row>
      
      {/* Alertas de Suprimentos */}
      <Row style={{ marginTop: 16 }}>
         <Col span={24}>
            {data.compras.filter(c => c.status === "Aguardando").length > 0 && (
                <Alert 
                  title="Existem pedidos de compra aguardando aprovação." 
                  type="warning" 
                  showIcon 
                  action={<Button size="small" type="link" onClick={() => window.location.href='/compras'}>Verificar</Button>}
                />
            )}
         </Col>
      </Row>
    </div>
  );
}
