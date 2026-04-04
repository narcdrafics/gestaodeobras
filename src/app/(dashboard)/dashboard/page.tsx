"use client";

import React from "react";
import { Card, Col, Row, Statistic, Typography, Table, Progress, Tag, Alert } from "antd";
import { ToolOutlined, WarningOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";

const { Title, Text } = Typography;

export default function DashboardOverview() {
  const { data, loading } = useTenantData();

  if (loading) {
    return <div style={{ padding: 24 }}>Carregando dados da Obra...</div>;
  }

  // == 1. Contadores Básicos ==
  const obrasAtivas = data.obras.filter(o => ['Em andamento', 'Planejada'].includes(o?.status));
  const tarefasPendentes = data.tarefas.filter(t => t?.status !== 'Concluída');

  // == 2. Cálculos Financeiros (Mês Atual) ==
  const monthPrefix = new Date().toISOString().substring(0, 7); // ex: 2026-04
  const financMes = data.financeiro.filter(f => f?.data?.startsWith(monthPrefix));
  const despesasMes = financMes.filter(f => f?.tipo === 'Saída' || !f?.tipo).reduce((acc, f) => acc + (Number(f?.real) || 0), 0);
  
  // == 3. Cálculos de RH e Diárias Semanal ==
  const tDay = new Date();
  const fSemana = new Date(tDay);
  fSemana.setDate(fSemana.getDate() - fSemana.getDay()); // Domingo da semana atual
  const strSemana = fSemana.toISOString().split('T')[0];
  const presencaSemana = data.presenca.filter(p => p?.data && p.data >= strSemana);
  const totalDiariasSemana = presencaSemana.reduce((acc, p) => acc + (Number(p?.total) || 0), 0);

  // == 4. Progresso Geral (Tarefas Obras Ativas) ==
  const pctConcluidas = data.tarefas.length > 0 
    ? Math.round((data.tarefas.filter(t => t?.status === 'Concluída').length / data.tarefas.length) * 100) 
    : 0;

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
         <Alert message="Nenhuma obra ativa encontrada. Comece cadastrando uma nova obra!" type="info" showIcon style={{ marginBottom: 24 }} />
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
              valueStyle={{ color: '#cf1322' }} 
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
              valueStyle={{ color: '#d48806' }} 
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
          <Card variant="borderless" title="Progresso Físico Global" style={{ height: '100%', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress type="dashboard" percent={pctConcluidas} size={180} />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Tarefas Concluídas x Total</Text>
              </div>
            </div>
          </Card>
        </Col>
        
        {/* Top Obras */}
        <Col xs={24} lg={16}>
          <Card variant="borderless" title="Suas Obras em Andamento" style={{ height: '100%', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
            <Table 
              dataSource={obrasAtivas.map(o => ({ ...o, key: o.cod || o.nome }))} 
              columns={columnsObras} 
              pagination={false} 
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
