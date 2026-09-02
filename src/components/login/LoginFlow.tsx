'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { UsuarioLogin } from '@/lib/session';
import { iniciarSesion, cambiarPin } from '@/app/actions/auth';
import { PinPad } from '@/components/ui/PinPad';
import styles from './LoginFlow.module.css';

interface LoginFlowProps {
  usuarios: UsuarioLogin[];
  /** Mensaje si no se pudo cargar la lista */
  errorCarga?: string;
}

/** Pasos de la entrada, en orden */
type Paso =
  | { tipo: 'elegir-persona' }
  | { tipo: 'pin'; usuario: UsuarioLogin }
  // Primera vez (o tras un reseteo): la persona elige su propio PIN
  | { tipo: 'pin-nuevo'; usuario: UsuarioLogin; pinTemporal: string }
  | { tipo: 'pin-nuevo-repetir'; usuario: UsuarioLogin; pinTemporal: string; pinNuevo: string };

const ICONO_ROL: Record<string, string> = {
  admin: '👑',
  cajero: '🧾',
  cocina: '👨‍🍳',
};

const ETIQUETA_ROL: Record<string, string> = {
  admin: 'Administración',
  cajero: 'Caja y pedidos',
  cocina: 'Cocina',
};

/**
 * Entrada al sistema: se toca el nombre y se marca el PIN.
 *
 * Si es la primera vez —o si administración le reseteó el PIN—, no se entra
 * directo: la persona tiene que elegir su propio PIN, que desde ese momento
 * no conoce nadie más.
 */
export const LoginFlow: React.FC<LoginFlowProps> = ({ usuarios, errorCarga }) => {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir-persona' });
  const [pin, setPin] = useState('');
  const [error, setError] = useState(errorCarga ?? '');
  const [cargando, setCargando] = useState(false);

  const volverAlInicio = () => {
    setPaso({ tipo: 'elegir-persona' });
    setPin('');
    setError('');
  };

  const elegirPersona = (usuario: UsuarioLogin) => {
    setPaso({ tipo: 'pin', usuario });
    setPin('');
    setError('');
  };

  /** Paso 1: entrar con el PIN actual */
  const enviarPin = async (valor: string) => {
    if (paso.tipo !== 'pin') return;
    setCargando(true);
    setError('');

    const res = await iniciarSesion(paso.usuario.id, valor);

    if (!res.success) {
      setError(res.error);
      setPin('');
      setCargando(false);
      return;
    }

    if (res.debeCambiarPin) {
      setPaso({ tipo: 'pin-nuevo', usuario: paso.usuario, pinTemporal: valor });
      setPin('');
      setCargando(false);
      return;
    }

    router.push(res.destino);
    router.refresh();
  };

  /** Paso 2: escribir el PIN nuevo */
  const enviarPinNuevo = (valor: string) => {
    if (paso.tipo !== 'pin-nuevo') return;
    setPaso({
      tipo: 'pin-nuevo-repetir',
      usuario: paso.usuario,
      pinTemporal: paso.pinTemporal,
      pinNuevo: valor,
    });
    setPin('');
    setError('');
  };

  /** Paso 3: repetirlo, para no quedar fuera por un dedazo */
  const confirmarPinNuevo = async (valor: string) => {
    if (paso.tipo !== 'pin-nuevo-repetir') return;

    if (valor !== paso.pinNuevo) {
      setError('Los dos PIN no coinciden. Empecemos otra vez.');
      setPaso({ tipo: 'pin-nuevo', usuario: paso.usuario, pinTemporal: paso.pinTemporal });
      setPin('');
      return;
    }

    setCargando(true);
    setError('');

    const res = await cambiarPin(paso.usuario.id, paso.pinTemporal, valor);

    if (!res.success) {
      setError(res.error);
      setPaso({ tipo: 'pin-nuevo', usuario: paso.usuario, pinTemporal: paso.pinTemporal });
      setPin('');
      setCargando(false);
      return;
    }

    router.push(res.destino);
    router.refresh();
  };

  const alCompletar = (valor: string) => {
    if (paso.tipo === 'pin') return enviarPin(valor);
    if (paso.tipo === 'pin-nuevo') return enviarPinNuevo(valor);
    if (paso.tipo === 'pin-nuevo-repetir') return confirmarPinNuevo(valor);
  };

  return (
    <main className={styles.pantalla}>
      <div className={styles.tarjeta}>
        <Image
          src="/logo.png"
          alt="Ricuras FegaF"
          width={72}
          height={72}
          className={styles.logo}
          priority
        />

        {paso.tipo === 'elegir-persona' ? (
          <>
            <h1 className={styles.titulo}>¿Quién eres?</h1>
            <p className={styles.subtitulo}>Toca tu nombre para entrar</p>

            {usuarios.length === 0 ? (
              <p className={styles.vacio}>
                Todavía no hay nadie registrado. Pide que te den de alta desde el dashboard.
              </p>
            ) : (
              <div className={styles.personas}>
                {usuarios.map((usuario) => (
                  <button
                    key={usuario.id}
                    type="button"
                    className={styles.persona}
                    onClick={() => elegirPersona(usuario)}
                  >
                    <span className={styles.personaIcono}>{ICONO_ROL[usuario.rol] ?? '👤'}</span>
                    <span className={styles.personaNombre}>{usuario.nombre}</span>
                    <span className={styles.personaRol}>{ETIQUETA_ROL[usuario.rol] ?? usuario.rol}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className={styles.titulo}>
              {paso.tipo === 'pin' && `Hola, ${paso.usuario.nombre}`}
              {paso.tipo === 'pin-nuevo' && 'Elige tu PIN'}
              {paso.tipo === 'pin-nuevo-repetir' && 'Repítelo'}
            </h1>

            <p className={styles.subtitulo}>
              {paso.tipo === 'pin' && 'Marca tu PIN'}
              {paso.tipo === 'pin-nuevo' &&
                'Son 4 números que solo tú vas a saber. Ni la administración puede verlos.'}
              {paso.tipo === 'pin-nuevo-repetir' && 'Márcalo otra vez para confirmar'}
            </p>

            {error && <div className={styles.error}>{error}</div>}

            <PinPad
              valor={pin}
              onChange={setPin}
              onCompleto={alCompletar}
              disabled={cargando}
            />

            <button type="button" className={styles.volver} onClick={volverAlInicio}>
              {paso.tipo === 'pin' ? '← Elegir otro nombre' : '← Cancelar'}
            </button>
          </>
        )}
      </div>
    </main>
  );
};
