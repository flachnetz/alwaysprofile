package main

import (
	"context"
	po "github.com/flachnetz/startup/startup_postgres"
	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
	"sync"
)

type Repository struct {
	methodCacheLock sync.Mutex
	methodCache     map[int32]string
}

func NewRepository() *Repository {
	return &Repository{
		methodCache: map[int32]string{},
	}
}

func (r *Repository) FillCache(ctx context.Context) error {
	var values []struct {
		Id   int32  `db:"id"`
		Name string `db:"name"`
	}

	err := po.WithTransactionFromContext(ctx, func(tx *sqlx.Tx) error {
		return tx.Select(&values, `SELECT id, name FROM ap_method`)
	})

	if err != nil {
		return errors.WithMessage(err, "query database for names")
	}

	r.methodCacheLock.Lock()
	defer r.methodCacheLock.Unlock()
	for _, value := range values {
		r.methodCache[value.Id] = value.Name
	}

	return nil
}

func (r *Repository) MethodName(ctx context.Context, id int32) (string, error) {
	r.methodCacheLock.Lock()
	name, ok := r.methodCache[id]
	r.methodCacheLock.Unlock()

	if ok {
		return name, nil
	}

	err := po.WithTransactionFromContext(ctx, func(tx *sqlx.Tx) error {
		return tx.GetContext(ctx, &name, `SELECT name FROM ap_method WHERE id=$1`, id)
	})

	r.methodCacheLock.Lock()
	r.methodCache[id] = name
	r.methodCacheLock.Unlock()

	return name, errors.WithMessage(err, "lookup method name")
}
