"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, message, Typography, Row, Col, Alert, Tag } from "antd";
import { ShoppingCartOutlined, DollarOutlined, TruckOutlined, WarningOutlined } from "@ant-design/icons";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

interface CompraFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
  initialObraId?: string;
}

export function CompraFormDrawer({ visible, onClose, record, recordIndex, initialObraId }: CompraFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const { saveItem } = useFirebaseMutations();
  const { data } = useTenantData();

  const qtd = Form.useWatch('qtd', form) || 0;
  const vunit = Form.useWatch('vunit', form) || 0;
  const vorc = Form.useWatch('vorc', form) || 0;
  const status = Form.useWatch('status', form);

  const vtotal = Number((qtd * vunit).toFixed(2));
  const isDivergent = vorc > 0 && vtotal > vorc;

  useEffect(() => {
    if (visible && record) {
      form.setFieldsValue({
        num: record.num,
        data: record.data ? dayjs(record.data) : dayjs(),
        obra: record.obra || initialObraId,
        etapa: record.etapa,
        mat: record.mat,
        qtd: record.qtd || 1,
        unid: record.unid,
        status: record.status || "Aguardando",
        forn: record.forn,
        pixkey: record.pixkey,
        vunit: record.vunit || 0,
        vorc: record.vorc || 0,
        prazo: record.prazo ? dayjs(record.prazo) : null,
        receb: record.receb ? dayjs(record.receb) : null,
        conf: record.conf || "Sim",
        obs: record.obs,
      });
    } else if (visible) {
      form.resetFields();
      form.setFieldsValue({
         data: dayjs(),
         obra: initialObraId,
         status: "Aguardando",
         conf: "Sim",
         qtd: 1,
         vunit: 0,
         vorc: 0,
         num: `PED-${Math.floor(Math.random() * 90000) + 10000}`
      });
    }
  }, [visible, record, form, initialObraId]);

  const onFinish = async (values: any) => {
    setLoading(true);
    const payload = {
      num: values.num,
      data: values.data ? values.data.format("YYYY-MM-DD") : "",
      obra: values.obra,
      etapa: values.etapa || "",
      mat: values.mat || "",
      qtd: values.qtd || 1,
      unid: values.unid || "",
      status: values.status,
      forn: values.forn || "",
      pixkey: values.pixkey || "",
      vunit: values.vunit || 0,
      vtotal: vtotal,
      vorc: values.vorc || 0,
      prazo: values.prazo ? values.prazo.format("YYYY-MM-DD") : "",
      receb: values.receb ? values.receb.format("YYYY-MM-DD") : "",
      conf: values.conf || "Sim",
      obs: values.obs || ""
    };

    const success = await saveItem("compras", payload, recordIndex !== undefined ? recordIndex : -1);
    
    // Se estiver Entregue, poderíamos atualizar o estoque aqui no futuro
    
    if (success) {
      message.success("Pedido de compra registrado!");
      onClose();
    }
    setLoading(false);
  };

  return (
    <Drawer
      title={record ? "Editar Pedido" : "Novo Pedido de Compra"}
      width={600}
      onClose={onClose}
      open={visible}
      styles={{ body: { paddingBottom: 80 } }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button onClick={() => form.submit()} type="primary" loading={loading} style={{ backgroundColor: '#1890ff' }}>Salvar Pedido</Button>
        </Space>
      }
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="num" label="Nº Pedido">
               <Input readOnly style={{ width: '100%', background: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="data" label="Data Solicitação" rules={[{ required: true }]}>
               <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="obra" label="Obra Destino" rules={[{ required: true }]}>
           <Select placeholder="Selecione a Obra">
             {data.obras.map(o => <Option key={o.cod} value={o.cod}>{o.nome}</Option>)}
           </Select>
        </Form.Item>

        <Form.Item name="mat" label="Material / Serviço" rules={[{ required: true }]}>
           <Input placeholder="Ex: Cimento CP-II" />
        </Form.Item>

        <Row gutter={16}>
           <Col span={8}>
              <Form.Item name="etapa" label="Etapa (Orç.)">
                 <Input placeholder="Fundação" />
              </Form.Item>
           </Col>
           <Col span={8}>
              <Form.Item name="qtd" label="Qtd.">
                 <InputNumber style={{ width: '100%' }} />
              </Form.Item>
           </Col>
           <Col span={8}>
              <Form.Item name="unid" label="Unid.">
                 <Input placeholder="Saco, kg, m²" />
              </Form.Item>
           </Col>
        </Row>

        <Row gutter={16}>
           <Col span={12}>
              <Form.Item name="vunit" label="Vl. Unit. (R$)">
                 <InputNumber style={{ width: '100%' }} precision={2} />
              </Form.Item>
           </Col>
           <Col span={12}>
              <Form.Item name="vorc" label="Vl. Orçado (R$)">
                 <InputNumber style={{ width: '100%' }} precision={2} />
              </Form.Item>
           </Col>
        </Row>

        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
           <Row gutter={16} align="middle">
              <Col span={12}>
                 <Text type="secondary" style={{ fontSize: 12 }}>Valor Total do Pedido</Text><br/>
                 <Text strong style={{ fontSize: 18 }}>R$ {vtotal.toFixed(2)}</Text>
              </Col>
              <Col span={12}>
                 {isDivergent ? (
                    <Tag color="error" icon={<WarningOutlined />}>DIVERGENTE (Acima do Orçamento)</Tag>
                 ) : (
                    vorc > 0 && <Tag color="success">Dentro do Orçado</Tag>
                 )}
              </Col>
           </Row>
        </div>

        <Row gutter={16}>
           <Col span={12}>
              <Form.Item name="status" label="Status do Pedido">
                 <Select>
                    <Option value="Aguardando">Aguardando Aprovação</Option>
                    <Option value="Aprovada">Aprovada / Comprar</Option>
                    <Option value="Pedido Feito">Pedido Feito (Trânsito)</Option>
                    <Option value="Entregue">Recebido / Entregue</Option>
                    <Option value="Reprovada">Reprovada</Option>
                    <Option value="Divergência">Divergência de Itens</Option>
                 </Select>
              </Form.Item>
           </Col>
           <Col span={12}>
              <Form.Item name="conf" label="Conferido no Receb?">
                 <Select>
                    <Option value="Sim">Sim</Option>
                    <Option value="Não">Não</Option>
                 </Select>
              </Form.Item>
           </Col>
        </Row>

        <Form.Item name="forn" label="Fornecedor / Loja">
           <Input placeholder="Material de Construção Silva" />
        </Form.Item>

        <Form.Item name="pixkey" label="Chave PIX (Para Pagamento)">
           <Input placeholder="CNPJ, E-mail ou Telefone" />
        </Form.Item>

        <Row gutter={16}>
           <Col span={12}>
              <Form.Item name="prazo" label="Prazo Entrega">
                 <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
           </Col>
           <Col span={12}>
              <Form.Item name="receb" label="Data Recebimento">
                 <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
           </Col>
        </Row>

        <Form.Item name="obs" label="Observações">
           <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
