"use client";

import React, { useState } from "react";
import { Button, Card, Table, Tag, Typography, Tabs, Space, Statistic, Row, Col, Popconfirm } from "antd";
import { PlusOutlined, DeleteOutlined, WalletOutlined, DollarOutlined, SolutionOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { FinanceiroFormDrawer } from "@/components/financeiro/FinanceiroFormDrawer";

const { Title, Text } = Typography;

export default function FinanceiroPage() {
  const { data, loading } = useTenantData();
  const { deleteItem } = useFirebaseMutations();
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | undefined>(undefined);
  
  const formatBRL = (val: number) => (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleDelete = async (index: number) => {
    await deleteItem("financeiro", index);
  };

  const showDrawer = (record?: any, index?: number) => {
    if (record && index !== undefined) {
      setEditingRecord(record);
      setEditingIndex(index);
    } else {
      setEditingRecord(null);
      setEditingIndex(undefined);
    }
    setDrawerVisible(true);
  };

  const columnsFinanceiro = [
    { title: 'Data', dataIndex: 'data', key: 'data', render: (val: string) => <Tag>{val?.split('-').reverse().join('/')}</Tag> },
    { title: 'Descrição', dataIndex: 'desc', key: 'desc', render: (text: string, r: any) => <b>{text} <br/> <Text type="secondary" style={{fontSize: 11}}>{r.tipo}</Text></b> },
    { title: 'Beneficiário', dataIndex: 'forn', key: 'forn' },
    { title: 'Realizado (R$)', dataIndex: 'real', key: 'real', render: (val: number) => <Text strong>{formatBRL(val)}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val: string) => {
         const colors: any = { 'Pago': 'success', 'Parcial': 'warning', 'Pendente': 'default', 'Atrasado': 'error' };
         return <Tag color={colors[val] || 'default'}>{val}</Tag>;
    }},
    { title: 'Ações', key: 'actions', render: (_: any, record: any) => (
        <Space>
           <Button type="link" onClick={() => showDrawer(record, record.originalIndex)}>Editar</Button>
           <Popconfirm title="Apagar?" onConfirm={() => handleDelete(record.originalIndex)}>
             <Button type="text" danger icon={<DeleteOutlined />}></Button>
           </Popconfirm>
        </Space>
    )}
  ];

  const renderObraFinanceiro = (obraId: string) => {
     // 1. Lançamentos dessa obra (Caixa + Compras)
     const itensFinanceiro = data.financeiro.map((f, i) => ({...f, originalIndex: i})).filter(f => f.obra === obraId);
     const itensCompras = data.compras.filter(c => c.obra === obraId);
     
     const sumFinanceiro = itensFinanceiro.reduce((acc, curr) => acc + Number(curr.real || 0), 0);
     const sumCompras = itensCompras.reduce((acc, curr) => acc + Number(curr.vtotal || 0), 0);
     const sumReal = sumFinanceiro + sumCompras;
     
     const sumPrev = itensFinanceiro.reduce((acc, curr) => acc + Number(curr.prev || 0), 0);

     // 2. Trabalhadores alocados nesta obra (simples contains)
     const trabsDaObra = data.trabalhadores.filter(t => t.obras?.includes(obraId) || t.obra === obraId);
     
     // 3. Cruzamento para Diárias
     const calculoTrabs = trabsDaObra.map(tr => {
         const presencasDoTrab = data.presenca.filter((p: any) => (p.trab === tr.cod || p.tr === tr.cod) && p.obra === obraId); // Support legacy property names
         
         // Se for Empreiteiro, a lógica de valor da empreitada vem do salário acordado/valor pacote
         const isEmpreiteiro = tr.vinculo === "Empreiteiro";
         
         const qtdDias = presencasDoTrab.length;
         const diariaVal = Number(tr.diaria || 0);
         const totalDevido = isEmpreiteiro ? diariaVal : (qtdDias * diariaVal); // Se empreiteiro, pacote fechado. Senão, multiplica dia

         return {
            ...tr,
            qtdDias,
            totalDevido,
            isEmpreiteiro
         };
     });

     const equipeDireta = calculoTrabs.filter(t => !t.isEmpreiteiro);
     const empreiteiros = calculoTrabs.filter(t => t.isEmpreiteiro);

     const colTrabs = [
        { title: 'Profissional', dataIndex: 'nome', key: 'nome' },
        { title: 'Função', dataIndex: 'funcao', key: 'funcao' },
        { title: 'Dias Trabalhados', dataIndex: 'qtdDias', key: 'qtdDias', render: (val: number) => <Tag color="blue">{val} diárias</Tag> },
        { title: 'Valor Diária', dataIndex: 'diaria', key: 'diaria', render: (val: number) => formatBRL(val) },
        { title: 'Total Devido', dataIndex: 'totalDevido', key: 'totalDevido', render: (val: number) => <Text strong type="danger">{formatBRL(val)}</Text> },
     ];

     const colEmp = [
        { title: 'Empreiteiro / Equipe', dataIndex: 'nome', key: 'nome' },
        { title: 'Responsabilidade', dataIndex: 'funcao', key: 'funcao' },
        { title: 'Valor da Empreita', dataIndex: 'totalDevido', key: 'totalDevido', render: (val: number) => <Text strong type="danger">{formatBRL(val)}</Text> },
     ];

     return (
        <div>
           <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                 <Card bordered={false}>
                    <Statistic title="Total Gasto (Caixa)" value={sumReal} precision={2} prefix="R$" styles={{ content: { color: '#cf1322' } }} />
                 </Card>
              </Col>
              <Col span={8}>
                 <Card bordered={false}>
                    <Statistic title="Folha (Diárias devidas)" value={equipeDireta.reduce((acc, t) => acc + t.totalDevido, 0)} precision={2} prefix="R$" styles={{ content: { color: '#cf1322' } }} />
                 </Card>
              </Col>
              <Col span={8}>
                 <Card bordered={false}>
                    <Statistic title="Subcontratados (Empreita)" value={empreiteiros.reduce((acc, t) => acc + t.totalDevido, 0)} precision={2} prefix="R$" styles={{ content: { color: '#d48806' } }} />
                 </Card>
              </Col>
           </Row>

            <Card title={<><WalletOutlined /> Lançamentos Livro-Caixa</>} style={{ marginBottom: 24 }} extra={<Button onClick={() => showDrawer()} type="primary">Add Custo</Button>}>
               <Table 
                  columns={columnsFinanceiro} 
                  dataSource={itensFinanceiro} 
                  rowKey="originalIndex" 
                  pagination={false} 
                  size="small"
               />
            </Card>

           <Row gutter={24}>
              <Col span={8}>
                 <Card title={<><SolutionOutlined /> Folha de Pagamento (Diárias)</>}>
                    <Table columns={colTrabs} dataSource={equipeDireta} rowKey="cod" pagination={false} size="small" />
                 </Card>
              </Col>
               <Col span={8}>
                  <Card title={<><DollarOutlined /> Gestão de Empreiteiros</>}>
                     <Table columns={colEmp} dataSource={empreiteiros} rowKey="cod" pagination={false} size="small" />
                  </Card>
               </Col>
               <Col span={8}>
                  <Card title={<><ShoppingCartOutlined /> Compras da Obra</>}>
                     <Table 
                        dataSource={itensCompras.slice(0, 5)} 
                        pagination={false} 
                        size="small"
                        columns={[
                           { title: 'Material', dataIndex: 'mat', key: 'mat' },
                           { title: 'Valor', dataIndex: 'vtotal', key: 'vtotal', render: (v) => formatBRL(v) }
                        ]}
                     />
                  </Card>
               </Col>
            </Row>
        </div>
     );
  };

  const items = data.obras.map(obra => ({
     key: obra.cod,
     label: obra.nome,
     children: renderObraFinanceiro(obra.cod)
  }));
  
  if (items.length === 0) {
      items.push({ key: 'no-obra', label: 'Custo Geral (Sem Obra)', children: renderObraFinanceiro('') });
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Gestão Financeira</Title>
          <Text type="secondary">Custos, Diárias e Empreitas alocadas por Obra</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showDrawer()} size="large" style={{ backgroundColor: '#1890ff' }}>
          Registrar Lançamento
        </Button>
      </div>

      <Card variant="borderless" style={{ background: 'transparent' }} styles={{ body: { padding: 0 } }}>
         {loading ? (
             <p>Carregando livros contábeis...</p>
         ) : (
             <Tabs 
                defaultActiveKey={items[0]?.key} 
                items={items} 
                type="card"
                tabBarStyle={{ marginBottom: 24 }}
             />
         )}
      </Card>

      <FinanceiroFormDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        record={editingRecord}
        recordIndex={editingIndex}
      />
    </div>
  );
}
