"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, Upload, message, Slider } from "antd";
import { UploadOutlined, LoadingOutlined } from "@ant-design/icons";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import dayjs from "dayjs";

const { Option } = Select;

interface TarefaFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
}

export function TarefaFormDrawer({ visible, onClose, record, recordIndex }: TarefaFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { saveItem } = useFirebaseMutations();
  const { data } = useTenantData(); // Get obras to populate the Select

  useEffect(() => {
    if (visible && record) {
      form.setFieldsValue({
        cod: record.cod,
        obra: record.obra,
        etapa: record.etapa,
        frente: record.frente,
        desc: record.desc,
        resp: record.resp,
        prior: record.prior || "Média",
        status: record.status || "A fazer",
        criacao: record.criacao ? dayjs(record.criacao) : dayjs(),
        datas: [
           record.prazo ? dayjs(record.prazo) : null,
           record.conclusao ? dayjs(record.conclusao) : null,
        ],
        perc: record.perc ? Number(record.perc) : 0,
        obs: record.obs,
      });
      setPhotoUrl(record.photoUrl || null);
    } else {
      form.resetFields();
      form.setFieldsValue({
          criacao: dayjs(),
          status: "A fazer",
          prior: "Média",
          perc: 0
      });
      setPhotoUrl(null);
    }
  }, [visible, record, form]);

  const customUploadRequest = async ({ file, onSuccess, onError }: any) => {
    if (!user?.tenantId) return onError("Sem Tenant");
    setUploading(true);
    
    try {
       const fileRef = storageRef(storage, `tenants/${user.tenantId}/tarefas/${Date.now()}_${file.name}`);
       await uploadBytes(fileRef, file);
       const dlUrl = await getDownloadURL(fileRef);
       setPhotoUrl(dlUrl);
       onSuccess("ok");
    } catch (e) {
       console.error("Upload error", e);
       onError(e);
       message.error("Erro ao fazer upload da evidência.");
    } finally {
       setUploading(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    
    const payload = {
      cod: values.cod || `TF${Math.floor(Math.random() * 10000)}`,
      obra: values.obra,
      etapa: values.etapa || "",
      frente: values.frente || "",
      desc: values.desc || "",
      resp: values.resp || "",
      prior: values.prior,
      status: values.status,
      criacao: values.criacao ? values.criacao.format("YYYY-MM-DD") : "",
      prazo: values.datas && values.datas[0] ? values.datas[0].format("YYYY-MM-DD") : "",
      conclusao: values.datas && values.datas[1] ? values.datas[1].format("YYYY-MM-DD") : "",
      perc: values.perc || 0,
      obs: values.obs || "",
      photoUrl: photoUrl || ""
    };

    const success = await saveItem("tarefas", payload, recordIndex !== undefined ? recordIndex : -1);
    
    if (success) {
      message.success(record ? "Tarefa atualizada!" : "Tarefa cadastrada!");
      form.resetFields();
      setPhotoUrl(null);
      onClose();
    }
    setLoading(false);
  };

  return (
    <Drawer
      title={record ? "Editar Tarefa" : "Nova Tarefa"}
      width={600}
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
          <Form.Item name="cod" label="Código" style={{ width: 120 }}>
            <Input disabled placeholder="Auto" />
          </Form.Item>
          <Form.Item name="obra" label="Obra Destino" rules={[{ required: true, message: 'Vincule a uma obra' }]} style={{ flex: 1 }}>
            <Select placeholder="Selecione a Obra" showSearch optionFilterProp="children">
              {data.obras.map((o: any) => (
                <Option key={o.cod} value={o.cod}>{o.nome}</Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <Form.Item name="desc" label="Descrição da Tarefa" rules={[{ required: true, message: 'Insira uma descrição' }]}>
          <Input.TextArea rows={2} placeholder="Ex: Preparo de ferragens para a laje..." />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="etapa" label="Etapa" style={{ flex: 1 }}>
            <Input placeholder="Fundação" />
          </Form.Item>
          <Form.Item name="frente" label="Frente de Serviço" style={{ flex: 1 }}>
            <Input placeholder="Bloco A" />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="status" label="Status" style={{ flex: 1 }}>
            <Select>
              <Option value="A fazer">A fazer</Option>
              <Option value="Em andamento">Em andamento</Option>
              <Option value="Concluída">Concluída</Option>
              <Option value="Atrasada">Atrasada</Option>
              <Option value="Pausada">Pausada</Option>
            </Select>
          </Form.Item>
          <Form.Item name="prior" label="Prioridade" style={{ flex: 1 }}>
            <Select>
              <Option value="Alta">Alta</Option>
              <Option value="Média">Média</Option>
              <Option value="Baixa">Baixa</Option>
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="criacao" label="Data Criação" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="datas" label="Prazo Prev. / Conclusão Real" style={{ flex: 2 }}>
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={['Prazo', 'Finalizado']} />
          </Form.Item>
        </div>

        <Form.Item name="resp" label="Responsável" >
           <Input placeholder="Equipe terceirizada ou Mestre" />
        </Form.Item>

        <Form.Item name="perc" label="% Concluído" >
            <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
        </Form.Item>

        <Form.Item label="Evidência (Foto/Doc)">
           <Upload
              name="file"
              customRequest={customUploadRequest}
              showUploadList={false}
           >
             <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}>
               {uploading ? 'Enviando...' : 'Fazer Upload'}
             </Button>
           </Upload>
           {photoUrl && (
             <div style={{ marginTop: 12 }}>
               <img src={photoUrl} alt="Evidência" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #d9d9d9' }} />
               <br />
               <Button type="link" danger onClick={() => setPhotoUrl(null)} style={{ padding: 0, marginTop: 8 }}>Remover Imagem</Button>
             </div>
           )}
        </Form.Item>

        <Form.Item name="obs" label="Observações Livres">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
