"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, Upload, message, Typography } from "antd";
import { UploadOutlined, LoadingOutlined } from "@ant-design/icons";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import dayjs from "dayjs";

const { Option } = Select;

interface TrabalhadorFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
  initialObra?: string;
}

export function TrabalhadorFormDrawer({ visible, onClose, record, recordIndex, initialObra }: TrabalhadorFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { saveItem } = useFirebaseMutations();
  const { data } = useTenantData();

  useEffect(() => {
    if (visible && record) {
      form.setFieldsValue({
        cod: record.cod,
        nome: record.nome,
        cpf: record.cpf,
        funcao: record.funcao,
        vinculo: record.vinculo || "Informal",
        equipe: record.equipe || "Própria",
        obra: record.obra || initialObra,
        diaria: record.diaria ? Number(record.diaria) : 0,
        pgto: record.pgto || "PIX",
        pixtipo: record.pixtipo || "cpf",
        pixkey: record.pixkey,
        contato: record.contato,
        status: record.status || "Ativo",
        admissao: record.admissao ? dayjs(record.admissao) : null,
        endereco: record.endereco,
        cidade: record.cidade,
      });
      setFotoUrl(record.fotoUrl || null);
    } else if (visible) {
      form.resetFields();
      form.setFieldsValue({
          vinculo: "Informal",
          equipe: "Própria",
          status: "Ativo",
          pgto: "PIX",
          pixtipo: "cpf",
          obra: initialObra
      });
      setFotoUrl(null);
    }
  }, [visible, record, form, initialObra]);

  const customUploadRequest = async ({ file, onSuccess, onError }: any) => {
    if (!user?.tenantId) return onError("Sem Tenant");
    setUploading(true);
    
    try {
       const fileRef = storageRef(storage, `tenants/${user.tenantId}/trabalhadores/${Date.now()}_${file.name}`);
       await uploadBytes(fileRef, file);
       const dlUrl = await getDownloadURL(fileRef);
       setFotoUrl(dlUrl);
       onSuccess("ok");
    } catch (e) {
       console.error("Upload error", e);
       onError(e);
       message.error("Erro ao fazer upload da foto.");
    } finally {
       setUploading(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    
    const payload = {
      cod: values.cod || `TR${Math.floor(Math.random() * 10000)}`,
      nome: values.nome,
      cpf: values.cpf || "",
      funcao: values.funcao || "",
      vinculo: values.vinculo,
      equipe: values.equipe || "Própria",
      obra: values.obra,
      diaria: values.diaria || 0,
      pgto: values.pgto || "PIX",
      pixtipo: values.pixtipo || "cpf",
      pixkey: values.pixkey || "",
      contato: values.contato || "",
      status: values.status || "Ativo",
      admissao: values.admissao ? values.admissao.format("YYYY-MM-DD") : "",
      fotoUrl: fotoUrl || "",
      endereco: values.endereco || "",
      cidade: values.cidade || ""
    };

    const success = await saveItem("trabalhadores", payload, recordIndex !== undefined ? recordIndex : -1);
    
    if (success) {
      message.success(record ? "Trabalhador atualizado!" : "Trabalhador cadastrado!");
      form.resetFields();
      setFotoUrl(null);
      onClose();
    }
    setLoading(false);
  };

  return (
    <Drawer
      title={record ? "Editar Trabalhador" : "Novo Trabalhador"}
      width={640}
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
          <Form.Item name="cod" label="Cód. Trabalhador" style={{ width: 140 }}>
            <Input placeholder="TR001" />
          </Form.Item>
          <Form.Item name="nome" label="Nome Completo" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="cpf" label="CPF" style={{ flex: 1 }}>
            <Input placeholder="000.000.000-00" />
          </Form.Item>
          <Form.Item name="funcao" label="Função" style={{ flex: 1 }}>
             <Input placeholder="Ex: Pedreiro" />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="vinculo" label="Vínculo" style={{ flex: 1 }}>
            <Select>
              <Option value="CLT">CLT</Option>
              <Option value="Informal">Informal</Option>
              <Option value="Empreiteiro">Empreiteiro</Option>
            </Select>
          </Form.Item>
          <Form.Item name="obra" label="Obra Alocada" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select placeholder="Escolha a Obra">
              {data.obras.map(o => (
                 <Option key={o.cod} value={o.cod}>{o.nome}</Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="diaria" label="Valor Diária / Salário (R$)" style={{ flex: 1 }}>
             <InputNumber style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item name="admissao" label="Data de Início" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>

        <Form.Item label="Foto de Perfil">
           <Upload
              name="avatar"
              customRequest={customUploadRequest}
              showUploadList={false}
           >
             <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}>
               {uploading ? 'Enviando...' : 'Fazer Upload de Foto'}
             </Button>
           </Upload>
           {fotoUrl && (
             <div style={{ marginTop: 12 }}>
               <img src={fotoUrl} alt="Avatar" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }} />
             </div>
           )}
        </Form.Item>

        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
           <Typography.Text strong>Dados de Pagamento (PIX)</Typography.Text>
           <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <Form.Item name="pixtipo" label="Tipo Chave" style={{ flex: 1 }}>
                <Select>
                   <Option value="cpf">CPF</Option>
                   <Option value="email">E-mail</Option>
                   <Option value="telefone">Telefone</Option>
                   <Option value="aleatoria">Aleatória</Option>
                </Select>
              </Form.Item>
              <Form.Item name="pixkey" label="Chave PIX" style={{ flex: 2 }}>
                <Input />
              </Form.Item>
           </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="contato" label="Contato / Telefone" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status" style={{ flex: 1 }}>
            <Select>
              <Option value="Ativo">Ativo</Option>
              <Option value="Inativo">Inativo</Option>
              <Option value="Afastado">Afastado</Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item name="endereco" label="Endereço">
           <Input />
        </Form.Item>

        <Form.Item name="cidade" label="Cidade / UF">
           <Input />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
