"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, message, Typography } from "antd";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

interface FinanceiroFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
  initialObra?: string;
}

export function FinanceiroFormDrawer({ visible, onClose, record, recordIndex, initialObra }: FinanceiroFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const statusPgto = Form.useWatch('status', form);
  const prev = Form.useWatch('prev', form) || 0;
  const real = Form.useWatch('real', form) || 0;
  
  const { saveItem } = useFirebaseMutations();
  const { data } = useTenantData();

  useEffect(() => {
    if (visible && record) {
      form.setFieldsValue({
        data: record.data ? dayjs(record.data) : dayjs(),
        obra: record.obra,
        etapa: record.etapa,
        tipo: record.tipo || "Geral",
        desc: record.desc,
        forn: record.forn,
        prev: record.prev ? Number(record.prev) : 0,
        real: record.real ? Number(record.real) : 0,
        pgto: record.pgto || "PIX",
        status: record.status || "Pendente",
        valpago: record.valpago ? Number(record.valpago) : 0,
        nf: record.nf,
        obs: record.obs,
      });
    } else if (visible) {
      form.resetFields();
      form.setFieldsValue({
         data: dayjs(),
         obra: initialObra || undefined,
         status: "Pendente",
         tipo: "Material",
         pgto: "PIX",
         prev: 0,
         real: 0
      });
    }
  }, [visible, record, form, initialObra]);

  const onFinish = async (values: any) => {
    setLoading(true);
    
    // Auto-calcula a diferenca no payload para relatorios brutos
    const diferenca = parseFloat(values.prev || 0) - parseFloat(values.real || 0);

    const payload = {
      data: values.data ? values.data.format("YYYY-MM-DD") : "",
      obra: values.obra || "",
      etapa: values.etapa || "",
      tipo: values.tipo || "",
      desc: values.desc || "",
      forn: values.forn || "",
      prev: values.prev || 0,
      real: values.real || 0,
      diff: diferenca,
      pgto: values.pgto || "",
      status: values.status || "Pendente",
      valpago: values.status === "Parcial" ? (values.valpago || 0) : (values.status === "Pago" ? values.real : 0),
      nf: values.nf || "",
      obs: values.obs || ""
    };

    const success = await saveItem("financeiro", payload, recordIndex !== undefined ? recordIndex : -1);
    
    if (success) {
      message.success(record ? "Lançamento atualizado!" : "Custo inserido no caixa!");
      form.resetFields();
      onClose();
    }
    setLoading(false);
  };

  const diferenca = prev - real;

  return (
    <Drawer
      title={record ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
      size="large"
      onClose={onClose}
      open={visible}
      styles={{ body: { paddingBottom: 80 } }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button onClick={() => form.submit()} type="primary" loading={loading} style={{ backgroundColor: '#1890ff' }}>
            Salvar
          </Button>
        </Space>
      }
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="data" label="Data de Vencimento/Pago" rules={[{ required: true }]} style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="obra" label="Obra" rules={[{ required: true, message: 'Vincule a uma obra' }]} style={{ flex: 2 }}>
            <Select placeholder="Selecione" showSearch optionFilterProp="children">
              {data.obras.map((o: any) => (
                <Option key={o.cod} value={o.cod}>{o.nome}</Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <Form.Item name="desc" label="Descrição do Custo" rules={[{ required: true, message: 'Ex: Compra de 50 sacos de Cimento' }]}>
          <Input placeholder="Ex: Compra de cimento... ou Empreitada de Laje" />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="tipo" label="Categoria" style={{ flex: 1 }}>
            <Select>
              <Option value="Material">Material</Option>
              <Option value="Mão de obra própria">Mão de obra própria</Option>
              <Option value="Empreiteiro">Empreiteiro</Option>
              <Option value="Adiantamento">Adiantamento</Option>
              <Option value="Equipamento">Equipamento</Option>
              <Option value="Geral">Geral</Option>
            </Select>
          </Form.Item>
          <Form.Item name="forn" label="Fornecedor / Beneficiário" style={{ flex: 1 }}>
             <Input placeholder="Loja X, José Pedreiro..." />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 16, background: '#f8f9fa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <Form.Item name="prev" label="Valor Previsto (R$)" style={{ flex: 1, margin: 0 }}>
             <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>
          <Form.Item name="real" label="Custo Final Real (R$)" style={{ flex: 1, margin: 0 }}>
             <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             <Text type="secondary" style={{ fontSize: 12 }}>Diferença Automática</Text>
             <Text strong style={{ fontSize: 16, color: diferenca < 0 ? '#cf1322' : (diferenca > 0 ? '#389e0d' : 'inherit') }}>
                R$ {diferenca.toFixed(2)}
             </Text>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="pgto" label="Forma de Pgto" style={{ flex: 1 }}>
             <Select>
              <Option value="PIX">PIX</Option>
              <Option value="Dinheiro">Dinheiro</Option>
              <Option value="Boleto">Boleto</Option>
              <Option value="Transferência">Transferência</Option>
              <Option value="Cheque">Cheque</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Status" style={{ flex: 1 }}>
            <Select>
              <Option value="Pendente">Pendente</Option>
              <Option value="Pago">Pago Total</Option>
              <Option value="Parcial">Pgto. Parcial</Option>
              <Option value="Atrasado">Atrasado</Option>
            </Select>
          </Form.Item>
        </div>

        {statusPgto === "Parcial" && (
           <Form.Item name="valpago" label="Valor Pago nesta etapa Parcial (R$)" rules={[{ required: true, message: 'Insira quanto foi adiantado' }]}>
               <InputNumber style={{ width: '100%' }} />
           </Form.Item>
        )}

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="etapa" label="Etapa Relacionada" style={{ flex: 1 }}>
            <Input placeholder="Fase de Acabamento" />
          </Form.Item>
          <Form.Item name="nf" label="NF / Comprovante" style={{ flex: 1 }}>
             <Input placeholder="Número da Nota" />
          </Form.Item>
        </div>

        <Form.Item name="obs" label="Observações Livres">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
