// Package service — RealHelmRunner internals.
//
// This file wraps helm.sh/helm/v3's action package into the small
// helpers RealHelmRunner uses. Keeping it separate keeps handler_helm.go
// focused on the dispatch contract and lets tests replace the whole
// production runner via HelmHandler.WithRunner without pulling in
// action.Configuration / storage.Driver construction logic.
package service

import (
	"fmt"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/cli"
)

// actionNewInstall is a thin wrapper around action.NewInstall so tests
// can stub the call graph if needed. Kept unexported — production code
// always uses the real helm.sh/helm/v3 call.
func actionNewInstall(cfg *action.Configuration) *action.Install {
	i := action.NewInstall(cfg)
	// Reasonable defaults that mirror the helm CLI:
	i.ClientOnly = false
	i.Devel = true
	i.SubNotes = true
	i.DisableHooks = false
	i.DisableOpenAPIValidation = false
	i.Atomic = false
	i.SkipCRDs = false
	return i
}

// actionNewUpgrade mirrors action.NewUpgrade with defaults.
func actionNewUpgrade(cfg *action.Configuration) *action.Upgrade {
	u := action.NewUpgrade(cfg)
	u.Devel = true
	u.DisableOpenAPIValidation = false
	u.SubNotes = true
	u.DisableHooks = false
	u.CleanupOnFail = false
	u.Atomic = false
	return u
}

// actionNewUninstall mirrors action.NewUninstall.
func actionNewUninstall(cfg *action.Configuration) *action.Uninstall {
	ui := action.NewUninstall(cfg)
	ui.DryRun = false
	ui.Wait = false
	ui.DisableHooks = false
	ui.KeepHistory = false
	return ui
}

// newActionConfiguration builds a helm action.Configuration from a
// kubeconfig path + namespace. Empty kubeConfigPath uses in-cluster.
//
// helm v3.15's action.Configuration is deliberately small; Init() wires
// the KubeClient (kube.New(getter)) and the release storage driver
// (secret-backed) from a genericclioptions.RESTClientGetter. We obtain
// that getter from cli.EnvSettings, exactly as the helm CLI does.
func newActionConfiguration(kubeConfigPath, namespace string) (*action.Configuration, error) {
	env := cli.New()
	if kubeConfigPath != "" {
		env.KubeConfig = kubeConfigPath
	}
	if namespace != "" {
		env.SetNamespace(namespace)
	}

	cfg := &action.Configuration{}
	if err := cfg.Init(env.RESTClientGetter(), namespace, "secret", nil); err != nil {
		return nil, fmt.Errorf("helm: action configuration init: %w", err)
	}
	return cfg, nil
}
