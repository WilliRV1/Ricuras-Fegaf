'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MOTIVOS_CANCELACION } from '@/lib/constants';
import { UsuarioLogin } from '@/lib/session';
import { listarUsuarios } from '@/app/actions/auth';
import { PinPad } from './PinPad';
import styles from './CancelOrderDialog.module.css';

interface CancelOrderDialogProps {
  isOpen: boolean;
  orderId: number;
  /** Texto extra bajo el título (ej. advertencia al anular desde liquidación) */
  aviso?: React.ReactNode;
  confirmLabel?: string;
  isLoading?: boolean;
  /** Mensaje de error del servidor (ej. PIN incorrecto), para no cerrar el diálogo */
  errorServidor?: string;
  /**
   * Muestra la casilla "voy a volver a montarlo". Solo tiene sentido donde se
   * pueden tomar pedidos (liquidación), no en el tablero de cocina.
   */
  ofrecerRehacer?: boolean;
  onConfirm: (datos: {
    motivo: string;
    usuarioId: number;
    pin: string;
    rehacer: boolean;
  }) => void;
  onCancel: () => void;
}

const OTRO = '__otro__';

/**
 * Diálogo para cancelar/anular un pedido.
 *
 * Dos pasos: el motivo y quién lo hace.
 *
 * El segundo paso pide el PIN a propósito. Las tablets quedan con la sesión
 * abierta y pasan de mano en mano, así que "quien tenga la sesión" no prueba
 * quién estaba ahí. Anular una venta es la acción que descuadra la caja: son
 * cuatro toques de más para que el registro sirva de algo.
 */
export const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({
  isOpen,
  orderId,
  aviso,
  confirmLabel = 'Cancelar pedido',
  isLoading = false,
  errorServidor,
  ofrecerRehacer = false,
  onConfirm,
  onCancel,
}) => {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [otroTexto, setOtroTexto] = useState('');
  const [rehacer, setRehacer] = useState(false);
  /** null = todavía eligiendo el motivo; si no, se está confirmando identidad */
  const [confirmando, setConfirmando] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioLogin[]>([]);
  const [quien, setQuien] = useState<UsuarioLogin | null>(null);
  const [pin, setPin] = useState('');

  // Al abrirse, empezar siempre en blanco. Se ajusta durante el render (patrón
  // recomendado por React) en lugar de un efecto, para no encadenar renders.
  const [estabaAbierto, setEstabaAbierto] = useState(isOpen);
  if (isOpen !== estabaAbierto) {
    setEstabaAbierto(isOpen);
    if (isOpen) {
      setSeleccion(null);
      setOtroTexto('');
      setRehacer(false);
      setConfirmando(false);
      setQuien(null);
      setPin('');
    }
  }

  // Si el servidor rechaza el PIN, se vacía para volver a intentar
  const [errorMostrado, setErrorMostrado] = useState(errorServidor);
  if (errorServidor !== errorMostrado) {
    setErrorMostrado(errorServidor);
    if (errorServidor) setPin('');
  }

  // La lista de personas se carga al abrir el diálogo, no antes: casi siempre
  // no se cancela nada y no vale la pena pedirla.
  useEffect(() => {
    if (!isOpen || usuarios.length > 0) return;
    let vigente = true;
    listarUsuarios().then((res) => {
      if (vigente && res.success) setUsuarios(res.usuarios);
    });
    return () => {
      vigente = false;
    };
  }, [isOpen, usuarios.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen || typeof document === 'undefined') return null;

  const motivoFinal = seleccion === OTRO ? otroTexto.trim() : seleccion ?? '';
  const puedeSeguir = motivoFinal.length > 0 && !isLoading;

  const confirmarConPin = (valor: string) => {
    if (!quien || isLoading) return;
    onConfirm({ motivo: motivoFinal, usuarioId: quien.id, pin: valor, rehacer });
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={() => {
        if (!isLoading) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {!confirmando ? (
          /* ── Paso 1: por qué se cancela ── */
          <>
            <h3 className={styles.title}>Cancelar el pedido #{orderId}</h3>
            {aviso && <div className={styles.aviso}>{aviso}</div>}
            <p className={styles.subtitle}>¿Por qué se cancela?</p>

            <div className={styles.motivos}>
              {MOTIVOS_CANCELACION.map((motivo) => (
                <button
                  key={motivo}
                  type="button"
                  className={`${styles.motivoBtn} ${seleccion === motivo ? styles.motivoActive : ''}`}
                  onClick={() => setSeleccion(motivo)}
                  disabled={isLoading}
                >
                  {motivo}
                </button>
              ))}

              <button
                type="button"
                className={`${styles.motivoBtn} ${seleccion === OTRO ? styles.motivoActive : ''}`}
                onClick={() => setSeleccion(OTRO)}
                disabled={isLoading}
              >
                Otro motivo…
              </button>
            </div>

            {seleccion === OTRO && (
              <input
                type="text"
                className={styles.otroInput}
                placeholder="Escribe el motivo"
                value={otroTexto}
                onChange={(e) => setOtroTexto(e.target.value)}
                disabled={isLoading}
                autoFocus
                maxLength={120}
              />
            )}

            {ofrecerRehacer && (
              <label className={styles.rehacerBox}>
                <input
                  type="checkbox"
                  className={styles.rehacerCheck}
                  checked={rehacer}
                  onChange={(e) => setRehacer(e.target.checked)}
                  disabled={isLoading}
                />
                <span>
                  <strong>Voy a volver a montarlo</strong>
                  <span className={styles.rehacerHint}>
                    Se abre la pantalla de pedidos con los mismos productos cargados, para no
                    tener que digitarlos otra vez ni correr el riesgo de olvidarlo.
                  </span>
                </span>
              </label>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.volverBtn}
                onClick={onCancel}
                disabled={isLoading}
              >
                Volver
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => setConfirmando(true)}
                disabled={!puedeSeguir}
              >
                Continuar
              </button>
            </div>
          </>
        ) : !quien ? (
          /* ── Paso 2a: quién lo está haciendo ── */
          <>
            <h3 className={styles.title}>¿Quién está cancelando?</h3>
            <p className={styles.subtitle}>
              Toca tu nombre y marca tu PIN. Queda registrado para poder saber qué pasó con
              esta venta.
            </p>

            {usuarios.length === 0 ? (
              <div className={styles.aviso}>Cargando la lista de personas…</div>
            ) : (
              <div className={styles.responsables}>
                {usuarios.map((usuario) => (
                  <button
                    key={usuario.id}
                    type="button"
                    className={styles.responsableBtn}
                    onClick={() => {
                      setQuien(usuario);
                      setPin('');
                    }}
                    disabled={isLoading}
                  >
                    {usuario.nombre}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.volverBtn}
                onClick={() => setConfirmando(false)}
                disabled={isLoading}
              >
                ← Atrás
              </button>
            </div>
          </>
        ) : (
          /* ── Paso 2b: el PIN ── */
          <>
            <h3 className={styles.title}>{quien.nombre}, marca tu PIN</h3>
            <p className={styles.subtitle}>
              Anulando el pedido #{orderId} — {motivoFinal}
            </p>

            {errorServidor && <div className={styles.errorPin}>{errorServidor}</div>}

            <PinPad
              valor={pin}
              onChange={setPin}
              onCompleto={confirmarConPin}
              disabled={isLoading}
            />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.volverBtn}
                onClick={() => {
                  setQuien(null);
                  setPin('');
                }}
                disabled={isLoading}
              >
                ← Otro nombre
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => confirmarConPin(pin)}
                disabled={pin.length !== 4 || isLoading}
              >
                {isLoading ? 'Procesando...' : confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
