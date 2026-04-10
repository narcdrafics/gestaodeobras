"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, App } from "antd";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import dayjs from "dayjs";

const { Option } = Select;

interface ObraFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
}

export function ObraFormDrawer({ visible, onClose, record, recordIndex }: ObraFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const { saveItem } = useFirebaseMutations();

  useEffect(() => {
    if (visible && record) {
      // Map existing record to Form fields
      form.setFieldsValue({
        cod: record.cod,
        nome: record.nome,
        end: record.end,
        tipo: record.tipo || "Casa",
        status: record.status || "Planejada",
        datas: [
           record.inicio ? dayjs(record.inicio) : null,
           record.prazo ? dayjs(record.prazo) : null,
        ],
        orc: record.orc ? Number(record.orc) : undefined,
        mestre: record.mestre,
        eng: record.eng,
        cliente: record.cliente,
        clienteContato: record.clienteContato,
        contratoTipo: record.contratoTipo || "Empreitada Global",
        obs: record.obs,
      });
    } else {
      form.resetFields();
    }
  }, [visible, record, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    
    // Convert logic equivalent to old saveObra
    const payload = {
      cod: values.cod,
      nome: values.nome,
      end: values.end || "",
      tipo: values.tipo,
      status: values.status,
      inicio: values.datas && values.datas[0] ? values.datas[0].format("YYYY-MM-DD") : "",
      prazo: values.datas && values.datas[1] ? values.datas[1].format("YYYY-MM-DD") : "",
      orc: values.orc || 0,
      mestre: values.mestre || "",
      eng: values.eng || "",
      cliente: values.cliente || "",
      clienteContato: values.clienteContato || "",
      contratoTipo: values.contratoTipo || "",
      obs: values.obs || ""
    };

    const success = await saveItem("obras", payload, recordIndex !== undefined ? recordIndex : -1);
    
    if (success) {
      message.success(record ? "Obra atualizada com sucesso!" : "Obra cadastrada com sucesso!");
      form.resetFields();
      onClose();
    }
    setLoading(false);
  };

  return (
    <Drawer
      title={record ? "Editar Obra" : "Nova Obra"}
      size="large"
      onClose={onClose}
      open={visible}
      forceRender={true}
      styles={{
        body: { paddingBottom: 80 },
      }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button onClick={() => form.submit()} type="primary" loading={loading} style={{ backgroundColor: '#1890ff' }}>
            Salvar
          </Button>
        </Space>
      }
    >
      <Form layout="vertical" form={form} onFinish={onFinish} initialValues={{ status: 'Planejada', tipo: 'Casa' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          
          <Form.Item name="cod" label="Cód. Obra" rules={[{ required: true, message: 'Insira um código (ex: OB001)' }]}>
            <Input placeholder="OB001" />
          </Form.Item>

          <Form.Item name="nome" label="Nome da Obra" rules={[{ required: true, message: 'Insira um nome' }]}>
            <Input placeholder="Residência Silva" />
          </Form.Item>

          <Form.Item name="tipo" label="Tipo">
            <Select>
              <Option value="Casa">Casa</Option>
              <Option value="Sobrado">Sobrado</Option>
              <Option value="Comercial">Comercial</Option>
              <Option value="Reforma">Reforma</Option>
            </Select>
          </Form.Item>

          <Form.Item name="status" label="Status">
            <Select>
              <Option value="Planejada">Planejada</Option>
              <Option value="Em andamento">Em andamento</Option>
              <Option value="Concluída">Concluída</Option>
              <Option value="Pausada">Pausada</Option>
            </Select>
          </Form.Item>

          <Form.Item name="datas" label="Início / Prazo Previsto">
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="orc" label="Orçamento (R$)">
             <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>

          <Form.Item name="mestre" label="Mestre Responsável">
            <Input />
          </Form.Item>

          <Form.Item name="eng" label="Engenheiro">
            <Input />
          </Form.Item>
        </div>

        <Form.Item name="end" label="Endereço Completo">
            <Input placeholder="Rua das Flores, 12" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="cliente" label="Cliente / Dono">
            <Input />
          </Form.Item>

          <Form.Item name="clienteContato" label="Contato Cliente">
            <Input placeholder="(98) 98888-8888" />
          </Form.Item>

          <Form.Item name="contratoTipo" label="Tipo de Contrato">
            <Select>
              <Option value="Administração">Administração</Option>
              <Option value="Empreitada Global">Empreitada Global</Option>
              <Option value="Mão de Obra">Mão de Obra</Option>
              <Option value="Preço Máximo">Preço Máximo</Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item name="obs" label="Observações Livres">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
